"""Shared utilities for upload and metrics processing."""

import json
import os
import re
import logging
import hashlib
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
from io import BytesIO, StringIO
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import unicodedata

import pandas as pd

logger = logging.getLogger("upload_api")
logging.basicConfig(level=logging.INFO)

ALLOWED_TYPES = {"contratos", "imoveis", "atendimentos"}
PREVIEW_LIMIT = 20

# Global state for in-memory datasets (works for local dev, persists across warm invocations on serverless)
DATASETS: dict[str, pd.DataFrame] = {}
_DOTENV_CACHE: dict[str, str] | None = None
_IMOVIEW_AUTH_CACHE: dict[str, Any] | None = None


def _load_dotenv_values() -> dict[str, str]:
    global _DOTENV_CACHE
    if _DOTENV_CACHE is not None:
        return _DOTENV_CACHE

    values: dict[str, str] = {}
    candidate_paths = [
        Path.cwd() / ".env",
        Path(__file__).resolve().parents[1] / ".env",
    ]

    for path in candidate_paths:
        if not path.exists():
            continue

        try:
            for line in path.read_text(encoding="utf-8").splitlines():
                raw = line.strip()
                if not raw or raw.startswith("#") or "=" not in raw:
                    continue

                key, value = raw.split("=", 1)
                key = key.strip()
                cleaned_value = value.strip().strip('"').strip("'")
                if key and cleaned_value:
                    values[key] = cleaned_value
            break
        except Exception:
            continue

    _DOTENV_CACHE = values
    return values


def get_env_value(name: str) -> str:
    direct = os.getenv(name, "").strip()
    if direct:
        return direct

    vite_direct = os.getenv(f"VITE_{name}", "").strip()
    if vite_direct:
        return vite_direct

    dotenv_values = _load_dotenv_values()
    from_dotenv = dotenv_values.get(name, "").strip()
    if from_dotenv:
        return from_dotenv

    from_dotenv_vite = dotenv_values.get(f"VITE_{name}", "").strip()
    if from_dotenv_vite:
        return from_dotenv_vite

    return ""


def normalize_key(value: Any, index: int) -> str:
    text = str(value).strip() if value is not None else ""
    if not text:
        text = f"coluna_{index + 1}"

    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")

    return text or f"coluna_{index + 1}"


def normalize_dataframe(frame: pd.DataFrame) -> pd.DataFrame:
    cleaned = frame.dropna(axis=0, how="all").dropna(axis=1, how="all").copy()
    cleaned = cleaned.reset_index(drop=True)

    normalized_columns: list[str] = []
    used: set[str] = set()

    for idx, column in enumerate(cleaned.columns):
        candidate = normalize_key(column, idx)
        unique_candidate = candidate
        suffix = 2

        while unique_candidate in used:
            unique_candidate = f"{candidate}_{suffix}"
            suffix += 1

        used.add(unique_candidate)
        normalized_columns.append(unique_candidate)

    cleaned.columns = normalized_columns

    for column in cleaned.columns:
        series = cleaned[column]
        if pd.api.types.is_datetime64_any_dtype(series):
            cleaned[column] = series.dt.strftime("%Y-%m-%d")
        elif pd.api.types.is_numeric_dtype(series):
            cleaned[column] = series.where(pd.notna(series), None)
        else:
            cleaned[column] = (
                series.astype("string")
                .str.replace(r"\s+", " ", regex=True)
                .str.strip()
                .replace({"": None, "<NA>": None})
            )

    return cleaned


def parse_xls(raw: bytes) -> pd.DataFrame:
    buffer = BytesIO(raw)

    try:
        frame = pd.read_excel(buffer, engine="xlrd")
        logger.info("Parser usado: pandas.read_excel(engine=xlrd)")
        return frame
    except Exception as exc:
        logger.warning("Falha no read_excel com xlrd, tentando read_html. Erro: %s", exc)

    # Legacy .xls files are often HTML tables exported with .xls extension.
    html_content = raw.decode("latin-1", errors="ignore")
    tables = pd.read_html(StringIO(html_content))
    if not tables:
        raise ValueError("Nenhuma tabela foi encontrada no arquivo informado.")

    logger.info("Parser usado: pandas.read_html")
    return tables[0]


def to_json_safe(value: Any) -> Any:
    # Normalize pandas/numpy values to JSON-safe Python primitives.
    if pd.isna(value):
        return None

    if isinstance(value, (pd.Timestamp, datetime, date)):
        return value.isoformat()

    if isinstance(value, dict):
        return {str(k): to_json_safe(v) for k, v in value.items()}

    if isinstance(value, (list, tuple, set)):
        return [to_json_safe(v) for v in value]

    # Convert numpy scalar values (e.g., int64, float64) to Python native types.
    if hasattr(value, "item") and callable(getattr(value, "item")):
        try:
            return value.item()
        except Exception:
            pass

    return value


def key_token(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]", "", normalized.lower())


def find_column(columns: list[str], aliases: list[str]) -> str | None:
    token_to_column = {key_token(col): col for col in columns}
    for alias in aliases:
        token = key_token(alias)
        if token in token_to_column:
            return token_to_column[token]
    return None


def find_column_with_all_tokens(columns: list[str], required_tokens: list[str]) -> str | None:
    normalized_required = [key_token(token) for token in required_tokens if token]
    for col in columns:
        col_token = key_token(col)
        if all(token in col_token for token in normalized_required):
            return col
    return None


def to_datetime_series(series: pd.Series) -> pd.Series:
    text = series.astype("string")
    iso_mask = text.str.fullmatch(r"\d{4}-\d{2}-\d{2}", na=False)

    parsed = pd.Series(pd.NaT, index=series.index, dtype="datetime64[ns]")
    if iso_mask.any():
        parsed.loc[iso_mask] = pd.to_datetime(text.loc[iso_mask], errors="coerce", format="%Y-%m-%d")

    if (~iso_mask).any():
        parsed.loc[~iso_mask] = pd.to_datetime(text.loc[~iso_mask], errors="coerce", dayfirst=True)

    return parsed


def parse_number_value(value: Any) -> float:
    if value is None or pd.isna(value):
        return 0.0

    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).strip()
    if not text:
        return 0.0

    # Keep only numeric punctuation symbols.
    text = re.sub(r"[^0-9,.-]", "", text)

    if "," in text and "." in text:
        # pt-BR style: 1.234,56 -> 1234.56
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        # 1234,56 -> 1234.56
        text = text.replace(",", ".")

    try:
        return float(text)
    except Exception:
        return 0.0


def to_numeric_series(series: pd.Series) -> pd.Series:
    return series.apply(parse_number_value).astype(float)


def contains_rescindido(series: pd.Series) -> pd.Series:
    return (
        series.astype("string")
        .str.lower()
        .str.contains("rescind", regex=False, na=False)
    )


def contains_vago(series: pd.Series) -> pd.Series:
    text = series.astype("string").str.lower()
    return text.str.contains("vago", regex=False, na=False)


def contains_alugado(series: pd.Series) -> pd.Series:
    text = series.astype("string").str.lower()
    return text.str.contains("alugad", regex=False, na=False)


def parse_filter_dates(start_date: str, end_date: str) -> tuple[pd.Timestamp, pd.Timestamp]:
    def _parse_single(value: str) -> pd.Timestamp:
        value = value.strip()
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            return pd.to_datetime(value, errors="coerce", format="%Y-%m-%d")
        return pd.to_datetime(value, errors="coerce", dayfirst=True)

    start = _parse_single(start_date)
    end = _parse_single(end_date)

    if pd.isna(start) or pd.isna(end):
        raise ValueError("Datas invalidas. Use formato YYYY-MM-DD ou DD/MM/YYYY.")

    if start > end:
        raise ValueError("Data inicial nao pode ser maior que a data final.")

    return start.normalize(), end.normalize()


def parse_datetime_value(value: Any) -> pd.Timestamp | None:
    if value is None:
        return None

    parsed = pd.to_datetime(value, errors="coerce", utc=True)
    if pd.isna(parsed):
        return None

    if isinstance(parsed, pd.Timestamp):
        return parsed

    return pd.Timestamp(parsed)


def card_created_at(card: dict[str, Any]) -> pd.Timestamp | None:
    explicit_created = parse_datetime_value(card.get("dateCreated"))
    if explicit_created is not None:
        return explicit_created

    card_id = str(card.get("id") or "").strip()
    if len(card_id) >= 8:
        try:
            created_epoch = int(card_id[:8], 16)
            return pd.Timestamp(datetime.fromtimestamp(created_epoch, tz=timezone.utc))
        except Exception:
            return None

    return None


def card_completed_at(card: dict[str, Any]) -> pd.Timestamp | None:
    explicit_completed = parse_datetime_value(card.get("dateCompleted"))
    if explicit_completed is not None:
        return explicit_completed

    due_complete = bool(card.get("dueComplete"))
    if due_complete:
        return parse_datetime_value(card.get("due"))

    return None


def card_label_names(card: dict[str, Any]) -> list[str]:
    raw_labels = card.get("labels") or []
    names: list[str] = []

    for label in raw_labels:
        if isinstance(label, dict):
            name = str(label.get("name") or "").strip()
            color = str(label.get("color") or "").strip()
            if name:
                names.append(name)
            elif color:
                names.append(f"Cor: {color}")
        elif isinstance(label, str):
            cleaned = label.strip()
            if cleaned:
                names.append(cleaned)

    return names


def fetch_trello_cards() -> list[dict[str, Any]]:
    board_id = get_env_value("TRELLO_BOARD_ID")
    api_key = get_env_value("TRELLO_API_KEY")
    token = get_env_value("TRELLO_TOKEN")

    if not board_id or not api_key or not token:
        raise ValueError(
            "Integracao Trello nao configurada. Defina TRELLO_BOARD_ID, TRELLO_API_KEY e TRELLO_TOKEN."
        )

    params = urlencode(
        {
            "key": api_key,
            "token": token,
            "fields": "id,name,due,dueComplete,dateLastActivity,labels",
            "customFieldItems": "true",
        }
    )
    url = f"https://api.trello.com/1/boards/{board_id}/cards?{params}"

    request = Request(url, method="GET")

    try:
        with urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise ValueError(f"Erro ao consultar Trello: HTTP {exc.code}.") from exc
    except URLError as exc:
        raise ValueError(f"Falha de conexao com Trello: {exc.reason}.") from exc
    except Exception as exc:
        raise ValueError(f"Erro inesperado ao consultar Trello: {exc}") from exc

    if not isinstance(payload, list):
        raise ValueError("Resposta invalida da API do Trello ao buscar cards.")

    return [card for card in payload if isinstance(card, dict)]


def authenticate_imoview_access(force_refresh: bool = False) -> dict[str, Any]:
    global _IMOVIEW_AUTH_CACHE

    if _IMOVIEW_AUTH_CACHE is not None and not force_refresh:
        return _IMOVIEW_AUTH_CACHE

    base_url = get_env_value("IMOVIEW_BASE_URL") or "https://api.imoview.com.br"
    email = get_env_value("IMOVIEW_EMAIL")
    senha = get_env_value("IMOVIEW_SENHA")
    chave = get_env_value("IMOVIEW_CHAVE") or get_env_value("IMOVIEW_API_KEY")

    senha_md5 = senha
    if senha and not re.fullmatch(r"[a-fA-F0-9]{32}", senha):
        senha_md5 = hashlib.md5(senha.encode("utf-8")).hexdigest()

    missing: list[str] = []
    if not email:
        missing.append("IMOVIEW_EMAIL")
    if not senha:
        missing.append("IMOVIEW_SENHA")
    if not chave:
        missing.append("IMOVIEW_CHAVE")

    if missing:
        missing_names = ", ".join(missing)
        raise ValueError(
            f"Integracao Imoview nao configurada. Defina as variaveis: {missing_names}."
        )

    params = urlencode({"email": email, "senha": senha_md5})
    url = f"{base_url.rstrip('/')}/Usuario/App_ValidarAcesso?{params}"
    request = Request(
        url,
        method="GET",
        headers={
            "accept": "application/json",
            "chave": chave,
        },
    )

    try:
        with urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise ValueError(f"Erro ao autenticar no Imoview: HTTP {exc.code}.") from exc
    except URLError as exc:
        raise ValueError(f"Falha de conexao ao autenticar no Imoview: {exc.reason}.") from exc
    except Exception as exc:
        raise ValueError(f"Erro inesperado na autenticacao do Imoview: {exc}") from exc

    if not isinstance(payload, dict):
        raise ValueError("Resposta invalida do Imoview ao validar acesso.")

    codigo_acesso = str(payload.get("codigoacesso") or "").strip()
    if not codigo_acesso:
        raise ValueError("Autenticacao Imoview retornou sem codigoacesso.")

    _IMOVIEW_AUTH_CACHE = {
        "authenticated_at": datetime.now(timezone.utc).isoformat(),
        "codigousuario": payload.get("codigousuario"),
        "nomeusuario": payload.get("nomeusuario"),
        "codigoacesso": codigo_acesso,
        "raw": payload,
    }

    return _IMOVIEW_AUTH_CACHE


def format_imoview_date(value: pd.Timestamp) -> str:
    return value.strftime("%d/%m/%Y")


def parse_imoview_datetime(value: Any) -> pd.Timestamp | None:
    if value is None:
        return None

    if isinstance(value, (int, float)):
        numeric = float(value)
        if numeric > 0:
            try:
                # Imoview can return Unix epoch in seconds or milliseconds.
                if numeric > 1_000_000_000_000:
                    return pd.Timestamp(datetime.fromtimestamp(numeric / 1000.0, tz=timezone.utc))
                return pd.Timestamp(datetime.fromtimestamp(numeric, tz=timezone.utc))
            except Exception:
                return None

    text = str(value).strip()
    if not text:
        return None

    parsed = pd.to_datetime(text, errors="coerce", utc=True, dayfirst=True)
    if pd.isna(parsed):
        return None

    if isinstance(parsed, pd.Timestamp):
        return parsed

    return pd.Timestamp(parsed)


def extract_interaction_datetimes(raw_interacoes: Any) -> list[pd.Timestamp]:
    interactions: list[Any]
    if isinstance(raw_interacoes, list):
        interactions = raw_interacoes
    elif isinstance(raw_interacoes, dict):
        interactions = [raw_interacoes]
    else:
        return []

    parsed_dates: list[pd.Timestamp] = []
    for interaction in interactions:
        if not isinstance(interaction, dict):
            continue

        datahora = parse_imoview_datetime(interaction.get("datahora"))
        if datahora is not None:
            parsed_dates.append(datahora)

    return parsed_dates


def fetch_imoview_atendimentos(
    start: pd.Timestamp,
    end: pd.Timestamp,
    imoview_auth: dict[str, Any],
) -> list[dict[str, Any]]:
    base_url = get_env_value("IMOVIEW_BASE_URL") or "https://api.imoview.com.br"
    chave = get_env_value("IMOVIEW_CHAVE") or get_env_value("IMOVIEW_API_KEY")
    codigo_acesso = str(imoview_auth.get("codigoacesso") or "").strip()

    if not chave:
        raise ValueError("Integracao Imoview sem chave configurada (IMOVIEW_CHAVE).")
    if not codigo_acesso:
        raise ValueError("Codigo de acesso do Imoview nao disponivel para buscar atendimentos.")

    def _fetch_phase(fase: int) -> list[dict[str, Any]]:
        numero_registros = 20
        pagina = 1
        phase_records: list[dict[str, Any]] = []

        while True:
            params = urlencode(
                {
                    "numeroPagina": pagina,
                    "numeroRegistros": numero_registros,
                    "finalidade": 1,
                    "situacao": 0,
                    "fase": fase,
                    "opcaoAtendimento": 1,
                    "dataInicial": format_imoview_date(start),
                    "dataFinal": format_imoview_date(end),
                }
            )
            url = f"{base_url.rstrip('/')}/Atendimento/RetornarAtendimentos?{params}"
            request = Request(
                url,
                method="GET",
                headers={
                    "accept": "application/json",
                    "chave": chave,
                    "codigoacesso": codigo_acesso,
                },
            )

            try:
                with urlopen(request, timeout=20) as response:
                    payload = json.loads(response.read().decode("utf-8"))
            except HTTPError as exc:
                if exc.code == 404:
                    break
                raise ValueError(f"Erro ao consultar atendimentos no Imoview: HTTP {exc.code}.") from exc
            except URLError as exc:
                raise ValueError(f"Falha de conexao ao buscar atendimentos no Imoview: {exc.reason}.") from exc
            except Exception as exc:
                raise ValueError(f"Erro inesperado ao buscar atendimentos no Imoview: {exc}") from exc

            registros: list[Any] = []
            if isinstance(payload, list):
                registros = payload
            elif isinstance(payload, dict):
                if isinstance(payload.get("lista"), list):
                    registros = payload.get("lista") or []
                elif isinstance(payload.get("atendimentos"), list):
                    registros = payload.get("atendimentos") or []
                elif isinstance(payload.get("dados"), list):
                    registros = payload.get("dados") or []
                elif payload.get("codigo") is not None:
                    registros = [payload]

            parsed_registros = [item for item in registros if isinstance(item, dict)]
            if not parsed_registros:
                break

            phase_records.extend(parsed_registros)

            if len(parsed_registros) < numero_registros:
                break

            pagina += 1
            if pagina > 200:
                raise ValueError(
                    "Paginacao de atendimentos do Imoview excedeu o limite de seguranca (200 paginas por fase)."
                )

        return phase_records

    fases = [1, 2, 3, 4, 5, 6, 7, 8]
    atendimentos_brutos: list[dict[str, Any]] = []

    # Parallelize phase retrieval with up to 5 concurrent requests.
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(_fetch_phase, fase) for fase in fases]
        for future in as_completed(futures):
            atendimentos_brutos.extend(future.result())

    atendimentos: list[dict[str, Any]] = []
    codigos_vistos: set[str] = set()
    for index, item in enumerate(atendimentos_brutos):
        codigo = str(item.get("codigo") or "").strip() or f"idx:{index}"
        if codigo in codigos_vistos:
            continue
        codigos_vistos.add(codigo)
        atendimentos.append(item)

    return atendimentos


def build_locacao_imoview_metrics(start: pd.Timestamp, end: pd.Timestamp) -> dict[str, Any]:
    warnings: list[str] = []
    imoview_integration = {
        "authenticated": False,
        "codigoacesso_disponivel": False,
        "codigousuario": None,
        "nomeusuario": None,
    }

    imoview_atendimentos_analisados = 0
    imoview_atendimentos_validos = 0
    imoview_tempo_medio_resposta_dias = None
    imoview_tempo_medio_resposta_horas = None
    imoview_tempo_medio_resposta_minutos = None
    imoview_atendimentos_intervalo_validos = 0
    imoview_intervalos_consolidados = 0
    imoview_tempo_medio_intervalo_dias = None
    imoview_tempo_medio_intervalo_horas = None
    imoview_tempo_medio_intervalo_minutos = None

    try:
        imoview_auth = authenticate_imoview_access()
        imoview_integration = {
            "authenticated": True,
            "codigoacesso_disponivel": bool(str(imoview_auth.get("codigoacesso") or "").strip()),
            "codigousuario": imoview_auth.get("codigousuario"),
            "nomeusuario": imoview_auth.get("nomeusuario"),
        }

        imoview_atendimentos = fetch_imoview_atendimentos(start, end, imoview_auth)
        imoview_atendimentos_analisados = len(imoview_atendimentos)
        start_day = start.date()
        end_day = end.date()

        tempos_resposta_dias: list[float] = []
        intervalos_entre_interacoes_dias: list[float] = []
        for atendimento in imoview_atendimentos:
            interacoes = extract_interaction_datetimes(atendimento.get("interacoes"))
            interacoes_no_periodo = sorted(
                ts.date()
                for ts in interacoes
                if start_day <= ts.date() <= end_day
            )

            if len(interacoes_no_periodo) >= 4:
                imoview_atendimentos_intervalo_validos += 1
                for index in range(3, len(interacoes_no_periodo)):
                    delta_intervalo_dias = float((interacoes_no_periodo[index] - interacoes_no_periodo[index - 1]).days)
                    if delta_intervalo_dias < 0:
                        continue
                    intervalos_entre_interacoes_dias.append(delta_intervalo_dias)

            if len(interacoes_no_periodo) < 4:
                continue

            # Business rule: compare only dates from the selected period.
            delta_dias = float((interacoes_no_periodo[3] - interacoes_no_periodo[0]).days)
            if delta_dias < 0:
                continue

            tempos_resposta_dias.append(float(delta_dias))

        imoview_atendimentos_validos = len(tempos_resposta_dias)
        if tempos_resposta_dias:
            imoview_tempo_medio_resposta_dias = float(
                sum(tempos_resposta_dias) / len(tempos_resposta_dias)
            )
            imoview_tempo_medio_resposta_horas = float(imoview_tempo_medio_resposta_dias * 24.0)
            imoview_tempo_medio_resposta_minutos = float(imoview_tempo_medio_resposta_horas * 60.0)

        imoview_intervalos_consolidados = len(intervalos_entre_interacoes_dias)
        if intervalos_entre_interacoes_dias:
            imoview_tempo_medio_intervalo_dias = float(
                sum(intervalos_entre_interacoes_dias) / len(intervalos_entre_interacoes_dias)
            )
            imoview_tempo_medio_intervalo_horas = float(imoview_tempo_medio_intervalo_dias * 24.0)
            imoview_tempo_medio_intervalo_minutos = float(imoview_tempo_medio_intervalo_horas * 60.0)
    except ValueError as exc:
        warnings.append(str(exc))
    except Exception as exc:
        logger.exception("Falha ao calcular KPI de tempo medio de resposta do Imoview")
        warnings.append(f"Nao foi possivel calcular KPI de resposta do Imoview: {exc}")

    return {
        "periodo": {
            "inicio": start.date().isoformat(),
            "fim": end.date().isoformat(),
        },
        "integrations": {
            "imoview": imoview_integration,
        },
        "metrics": {
            "tempo_medio_resposta_quarta_interacao_imoview": {
                "id": "5",
                "atendimentos_analisados": imoview_atendimentos_analisados,
                "atendimentos_com_4_interacoes": imoview_atendimentos_validos,
                "tempo_medio_dias": imoview_tempo_medio_resposta_dias,
                "tempo_medio_horas": imoview_tempo_medio_resposta_horas,
                "tempo_medio_minutos": imoview_tempo_medio_resposta_minutos,
            },
            "tempo_medio_intervalo_interacoes_imoview": {
                "id": "8",
                "atendimentos_analisados": imoview_atendimentos_analisados,
                "atendimentos_com_2_interacoes": imoview_atendimentos_intervalo_validos,
                "intervalos_consolidados": imoview_intervalos_consolidados,
                "tempo_medio_dias": imoview_tempo_medio_intervalo_dias,
                "tempo_medio_horas": imoview_tempo_medio_intervalo_horas,
                "tempo_medio_minutos": imoview_tempo_medio_intervalo_minutos,
            },
        },
        "warnings": warnings,
    }


def infer_type(filename: str | None) -> str | None:
    if not filename:
        return None

    lowered = filename.lower()

    if "contrat" in lowered:
        return "contratos"
    if "imove" in lowered or "imovel" in lowered:
        return "imoveis"
    if "atendimento" in lowered or "atend" in lowered:
        return "atendimentos"

    return None


def build_locacao_metrics(
    start: pd.Timestamp,
    end: pd.Timestamp,
    process_tags: list[str] | None = None,
    cancelados_filter: str = "exclude",
) -> dict[str, Any]:
    warnings: list[str] = []
    missing_types = [tp for tp in ALLOWED_TYPES if tp not in DATASETS]
    if missing_types:
        warnings.append(
            "Planilhas ausentes para analise: "
            f"{', '.join(sorted(missing_types))}. "
            "As metricas dependentes de planilha nao serao calculadas."
        )

    contratos = DATASETS.get("contratos", pd.DataFrame()).copy()
    imoveis = DATASETS.get("imoveis", pd.DataFrame()).copy()
    atendimentos = DATASETS.get("atendimentos", pd.DataFrame()).copy()

    imoview_integration = {
        "authenticated": None,
        "codigoacesso_disponivel": None,
        "codigousuario": None,
        "nomeusuario": None,
        "deferred": True,
    }

    contratos_cols = list(contratos.columns)
    imoveis_cols = list(imoveis.columns)
    atend_cols = list(atendimentos.columns)

    contrato_data_inicio_col = find_column(contratos_cols, ["datainicio", "inicio", "data_inicio"])
    contrato_data_rescisao_col = find_column(contratos_cols, ["datarescisao", "rescisao", "data_rescisao"])
    contrato_status_col = find_column(contratos_cols, ["situacao", "status", "statuscontrato"])
    contrato_valor_col = find_column(contratos_cols, ["valor", "valoraluguel", "valormensal", "aluguel", "valorcontrato"])
    contrato_motivo_col = find_column(contratos_cols, ["motivorescisao", "motivo_rescisao", "motivo"])

    imovel_data_cadastro_col = find_column(imoveis_cols, ["datacadastro", "data_cadastro", "dataentrada"])
    imovel_data_vago_desde_col = find_column(imoveis_cols, ["datavagodesde", "data_vago_desde", "vagodesde"])
    imovel_status_col = find_column(imoveis_cols, ["situacao", "status", "statusimovel"])
    imovel_data_alugado_col = find_column(
        imoveis_cols,
        [
            "dataalugado",
            "datalocacao",
            "data_locacao",
            "datahoraultimasituacao",
            "data_hora_ultima_situacao",
            "dataultimasituacao",
            "data_ultima_situacao",
            "dataultimamudancastatus",
            "data_ultima_mudanca_status",
            "ultimamudancastatus",
            "dataalteracaostatus",
            "data_atualizacao_status",
            "dtultimamudanca",
        ],
    )

    if not imovel_data_alugado_col:
        imovel_data_alugado_col = (
            find_column_with_all_tokens(imoveis_cols, ["data", "mudanca", "status"])
            or find_column_with_all_tokens(imoveis_cols, ["data", "alteracao", "status"])
            or find_column_with_all_tokens(imoveis_cols, ["ultima", "mudanca", "status"])
        )

    atend_fase_col = find_column(atend_cols, ["fase", "etapa", "statusfase"])
    atend_data_col = find_column(
        atend_cols,
        [
            "data",
            "dataatendimento",
            "data_atendimento",
            "datacadastro",
            "data_cadastro",
            "datahorainclusao",
            "data_hora_inclusao",
            "datainclusao",
            "data_inclusao",
        ],
    )

    # 1) Novos imoveis captados
    novos_imoveis_captados = 0
    if imovel_data_cadastro_col:
        cadastro_dates = to_datetime_series(imoveis[imovel_data_cadastro_col])
        novos_imoveis_captados = int(((cadastro_dates >= start) & (cadastro_dates <= end)).sum())
    else:
        warnings.append("Coluna de data de cadastro dos imoveis nao encontrada.")

    # 2) Churn (volume e valor)
    churn_volume = None
    churn_valor = None
    churn_volume_pct = None
    churn_valor_pct = None
    contratos_ativos_qtd = 0
    contratos_rescindidos_qtd = 0
    contratos_ativos_valor = 0.0
    contratos_rescindidos_valor = 0.0
    rescindidos_mask = pd.Series([False] * len(contratos), index=contratos.index)

    if contrato_data_inicio_col and contrato_data_rescisao_col:
        inicio = to_datetime_series(contratos[contrato_data_inicio_col])
        rescisao = to_datetime_series(contratos[contrato_data_rescisao_col])

        ativos_mask = (inicio <= end) & (rescisao.isna() | (rescisao >= start))
        rescindidos_mask = rescisao.between(start, end, inclusive="both")

        contratos_ativos_qtd = int(ativos_mask.sum())
        contratos_rescindidos_qtd = int(rescindidos_mask.sum())

        if contrato_valor_col:
            valores = to_numeric_series(contratos[contrato_valor_col])
            contratos_ativos_valor = float(valores[ativos_mask].sum())
            contratos_rescindidos_valor = float(valores[rescindidos_mask].sum())
        else:
            warnings.append("Coluna de valor dos contratos nao encontrada. Churn em valor pode ficar zerado.")

        if contratos_ativos_qtd > 0:
            churn_volume = contratos_rescindidos_qtd / contratos_ativos_qtd
            churn_volume_pct = churn_volume * 100

        if contratos_ativos_valor > 0:
            churn_valor = contratos_rescindidos_valor / contratos_ativos_valor
            churn_valor_pct = churn_valor * 100
    else:
        warnings.append("Colunas de DataInicio/DataRescisao nao encontradas para calculo de churn.")

    # 2.1) Churn por motivo
    churn_por_motivo: list[dict[str, Any]] = []
    if contrato_motivo_col and rescindidos_mask.any():
        motivos = contratos.loc[rescindidos_mask, contrato_motivo_col].astype("string").fillna("Nao informado")
        if contrato_valor_col:
            valores_rescindidos = to_numeric_series(contratos.loc[rescindidos_mask, contrato_valor_col])
        else:
            valores_rescindidos = pd.Series([0.0] * len(motivos), index=motivos.index)

        grouped = (
            pd.DataFrame({"motivo": motivos, "valor": valores_rescindidos})
            .groupby("motivo", dropna=False)
            .agg(quantidade=("motivo", "count"), valor=("valor", "sum"))
            .reset_index()
            .sort_values("quantidade", ascending=False)
        )
        churn_por_motivo = [
            {
                "motivo": str(row["motivo"]),
                "quantidade": int(row["quantidade"]),
                "valor": float(row["valor"]),
            }
            for _, row in grouped.iterrows()
        ]
    elif not contrato_motivo_col:
        warnings.append("Coluna MotivoRescisao nao encontrada para churn por motivo.")

    # 3) Prazo medio de permanencia (meses)
    prazo_medio_permanencia_meses = None
    if contrato_data_inicio_col and contrato_data_rescisao_col:
        inicio = to_datetime_series(contratos[contrato_data_inicio_col])
        rescisao = to_datetime_series(contratos[contrato_data_rescisao_col])
        rescindidos_status_mask = pd.Series([True] * len(contratos), index=contratos.index)

        if contrato_status_col:
            rescindidos_status_mask = contains_rescindido(contratos[contrato_status_col])

        permanencia_dias = (rescisao - inicio).dt.days
        validos = rescindidos_status_mask & permanencia_dias.notna() & (permanencia_dias >= 0)
        if validos.any():
            prazo_medio_permanencia_meses = float((permanencia_dias[validos] / 30.0).mean())
    else:
        warnings.append("Colunas DataInicio/DataRescisao ausentes para prazo medio de permanencia.")

    # 4) Taxa de cada fase
    fase_taxas: list[dict[str, Any]] = []
    total_atendimentos_periodo = 0
    if atend_fase_col:
        atend_filtrados = atendimentos.copy()
        if atend_data_col:
            atend_dates = to_datetime_series(atendimentos[atend_data_col])
            atend_filtrados = atendimentos[(atend_dates >= start) & (atend_dates <= end)]
        else:
            warnings.append("Coluna de data de atendimentos nao encontrada. Taxas por fase sem filtro de periodo.")

        total_atendimentos_periodo = int(len(atend_filtrados))
        if total_atendimentos_periodo > 0:
            fase_counts = (
                atend_filtrados[atend_fase_col]
                .astype("string")
                .fillna("Nao informado")
                .value_counts(dropna=False)
            )
            fase_taxas = [
                {
                    "fase": str(fase),
                    "quantidade": int(qtd),
                    "percentual": float((qtd / total_atendimentos_periodo) * 100.0),
                }
                for fase, qtd in fase_counts.items()
            ]
    else:
        warnings.append("Coluna Fase nao encontrada para taxa de cada fase.")

    # 6) Tempo medio de vacancia
    tempo_medio_vacancia_dias = None
    if imovel_data_vago_desde_col:
        vago_desde = to_datetime_series(imoveis[imovel_data_vago_desde_col]).dt.normalize()
        fim_vacancia = pd.Series([pd.NaT] * len(imoveis), index=imoveis.index, dtype="datetime64[ns]")

        if imovel_status_col:
            hoje = pd.Timestamp.now().normalize()
            status_series = imoveis[imovel_status_col]
            em_alugado = contains_alugado(status_series)
            em_vago = contains_vago(status_series)

            if imovel_data_alugado_col:
                data_ultima_situacao = to_datetime_series(imoveis[imovel_data_alugado_col]).dt.normalize()
                # Considera DataHoraUltimaSituacao apenas quando o status atual indica Alugado.
                fim_vacancia = data_ultima_situacao.where(em_alugado, pd.NaT)

            fim_vacancia = fim_vacancia.where(~(em_vago & fim_vacancia.isna()), hoje)
        else:
            warnings.append("Coluna de status dos imoveis nao encontrada para complementar fim da vacancia.")

        fim_no_periodo = fim_vacancia.between(start, end, inclusive="both")
        vacancia_dias = (fim_vacancia - vago_desde).dt.days
        vacancia_validos = (
            vago_desde.notna()
            & fim_vacancia.notna()
            & fim_no_periodo
            & vacancia_dias.notna()
            & (vacancia_dias >= 0)
        )

        if vacancia_validos.any():
            tempo_medio_vacancia_dias = float(vacancia_dias[vacancia_validos].mean())

        if not imovel_data_alugado_col:
            warnings.append("Coluna de data de aluguel/ultima mudanca de status nao encontrada para vacancia.")
    else:
        warnings.append("Coluna dataVagoDesde nao encontrada para tempo medio de vacancia.")

    trello_cards_total = 0
    trello_processos_concluidos = 0
    trello_processos_periodo = 0
    trello_media_geral_horas = None
    trello_media_geral_dias = None
    trello_categorias: list[dict[str, Any]] = []
    trello_available_tags: list[str] = []
    trello_tags_filtradas = [tag.strip() for tag in (process_tags or []) if str(tag).strip()]
    normalized_cancelados_filter = cancelados_filter.strip().lower() or "exclude"
    if normalized_cancelados_filter not in {"exclude", "include", "only"}:
        normalized_cancelados_filter = "exclude"

    try:
        trello_cards = fetch_trello_cards()
        trello_cards_total = len(trello_cards)

        duracoes_periodo_horas: list[float] = []
        por_categoria: dict[str, list[float]] = defaultdict(list)
        available_tags_set: set[str] = set()
        selected_tag_tokens = {key_token(tag) for tag in trello_tags_filtradas}

        for card in trello_cards:
            created_at = card_created_at(card)
            completed_at = card_completed_at(card)

            if created_at is None or completed_at is None:
                continue

            trello_processos_concluidos += 1

            completed_day = completed_at.tz_convert(None).normalize()
            if completed_day < start or completed_day > end:
                continue

            duracao_horas = (completed_at - created_at).total_seconds() / 3600.0
            if duracao_horas < 0:
                continue

            labels = card_label_names(card)
            categorias = labels if labels else ["Sem label"]
            for categoria in categorias:
                available_tags_set.add(categoria)

            has_cancelados_tag = any(key_token(categoria).startswith("cancelad") for categoria in categorias)
            if normalized_cancelados_filter == "exclude" and has_cancelados_tag:
                continue
            if normalized_cancelados_filter == "only" and not has_cancelados_tag:
                continue

            categorias_filtradas = categorias
            if selected_tag_tokens:
                categorias_filtradas = [
                    categoria for categoria in categorias if key_token(categoria) in selected_tag_tokens
                ]
                if not categorias_filtradas:
                    continue

            trello_processos_periodo += 1
            duracoes_periodo_horas.append(float(duracao_horas))

            for categoria in categorias_filtradas:
                por_categoria[categoria].append(float(duracao_horas))

        if duracoes_periodo_horas:
            trello_media_geral_horas = float(sum(duracoes_periodo_horas) / len(duracoes_periodo_horas))
            trello_media_geral_dias = float(trello_media_geral_horas / 24.0)

        trello_categorias = sorted(
            [
                {
                    "categoria": categoria,
                    "quantidade": len(valores),
                    "media_horas": float(sum(valores) / len(valores)),
                    "media_dias": float((sum(valores) / len(valores)) / 24.0),
                }
                for categoria, valores in por_categoria.items()
                if valores
            ],
            key=lambda item: item["media_horas"],
            reverse=True,
        )
        trello_available_tags = sorted(available_tags_set, key=lambda item: key_token(item))
    except ValueError as exc:
        warnings.append(str(exc))
    except Exception as exc:
        logger.exception("Falha ao calcular KPI de tempo medio dos processos Trello")
        warnings.append(f"Nao foi possivel calcular KPI do Trello: {exc}")

    return {
        "periodo": {
            "inicio": start.date().isoformat(),
            "fim": end.date().isoformat(),
        },
        "integrations": {
            "imoview": imoview_integration,
        },
        "metrics": {
            "novos_imoveis_captados": {
                "id": "1",
                "valor": novos_imoveis_captados,
            },
            "taxa_churn_rescisao": {
                "id": "2",
                "volume": {
                    "rescindidos": contratos_rescindidos_qtd,
                    "ativos": contratos_ativos_qtd,
                    "taxa": churn_volume,
                    "taxa_percentual": churn_volume_pct,
                },
                "valor": {
                    "rescindidos": contratos_rescindidos_valor,
                    "ativos": contratos_ativos_valor,
                    "taxa": churn_valor,
                    "taxa_percentual": churn_valor_pct,
                },
            },
            "churn_por_motivo": {
                "id": "2.1",
                "categorias": churn_por_motivo,
            },
            "prazo_medio_permanencia_ltv": {
                "id": "3",
                "meses": prazo_medio_permanencia_meses,
            },
            "taxa_cada_fase": {
                "id": "4",
                "total_atendimentos": total_atendimentos_periodo,
                "fases": fase_taxas,
            },
            "tempo_medio_resposta_quarta_interacao_imoview": {
                "id": "5",
                "atendimentos_analisados": 0,
                "atendimentos_com_4_interacoes": 0,
                "tempo_medio_dias": None,
                "tempo_medio_horas": None,
                "tempo_medio_minutos": None,
            },
            "tempo_medio_vacancia": {
                "id": "6",
                "dias": tempo_medio_vacancia_dias,
            },
            "tempo_medio_processo_trello": {
                "id": "7",
                "cards_total": trello_cards_total,
                "processos_concluidos": trello_processos_concluidos,
                "processos_no_periodo": trello_processos_periodo,
                "media_geral_horas": trello_media_geral_horas,
                "media_geral_dias": trello_media_geral_dias,
                "tags_filtradas": trello_tags_filtradas,
                "cancelados_filter": normalized_cancelados_filter,
                "available_tags": trello_available_tags,
                "categorias": trello_categorias,
            },
            "tempo_medio_intervalo_interacoes_imoview": {
                "id": "8",
                "atendimentos_analisados": 0,
                "atendimentos_com_2_interacoes": 0,
                "intervalos_consolidados": 0,
                "tempo_medio_dias": None,
                "tempo_medio_horas": None,
                "tempo_medio_minutos": None,
            },
        },
        "warnings": warnings,
        "dataset_info": {
            tp: {
                "rows": int(len(df)),
                "columns": int(len(df.columns)),
            }
            for tp, df in DATASETS.items()
        },
    }
