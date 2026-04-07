"""Shared utilities for upload and metrics processing."""

import re
import logging
from datetime import date, datetime
from io import BytesIO, StringIO
from typing import Any
import unicodedata

import pandas as pd

logger = logging.getLogger("upload_api")
logging.basicConfig(level=logging.INFO)

ALLOWED_TYPES = {"contratos", "imoveis", "atendimentos"}
PREVIEW_LIMIT = 20

# Global state for in-memory datasets (works for local dev, persists across warm invocations on serverless)
DATASETS: dict[str, pd.DataFrame] = {}


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


def build_locacao_metrics(start: pd.Timestamp, end: pd.Timestamp) -> dict[str, Any]:
    missing_types = [tp for tp in ALLOWED_TYPES if tp not in DATASETS]
    if missing_types:
        raise ValueError(f"Planilhas ausentes para analise: {', '.join(sorted(missing_types))}. Faca upload das 3 planilhas.")

    contratos = DATASETS["contratos"].copy()
    imoveis = DATASETS["imoveis"].copy()
    atendimentos = DATASETS["atendimentos"].copy()

    warnings: list[str] = []

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
        ["dataalugado", "datalocacao", "data_locacao", "dataultimamudancastatus", "data_ultima_mudanca_status"],
    )

    atend_fase_col = find_column(atend_cols, ["fase", "etapa", "statusfase"])
    atend_data_col = find_column(atend_cols, ["data", "dataatendimento", "data_atendimento", "datacadastro", "data_cadastro"])

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
        vago_desde = to_datetime_series(imoveis[imovel_data_vago_desde_col])
        valid_vago = vago_desde.notna()

        if imovel_data_alugado_col:
            fim_vacancia = to_datetime_series(imoveis[imovel_data_alugado_col])
        else:
            fim_vacancia = pd.Series([pd.NaT] * len(imoveis), index=imoveis.index)

        if imovel_status_col:
            status_series = imoveis[imovel_status_col]
            em_vago = contains_vago(status_series)
            em_alugado = contains_alugado(status_series)
        else:
            em_vago = pd.Series([False] * len(imoveis), index=imoveis.index)
            em_alugado = pd.Series([False] * len(imoveis), index=imoveis.index)
            warnings.append("Coluna de status dos imoveis nao encontrada para vacancia.")

        hoje = pd.Timestamp.now().normalize()

        fim_final = fim_vacancia.copy()
        fim_final = fim_final.where(~(valid_vago & em_alugado & fim_final.isna()), hoje)
        fim_final = fim_final.where(~(valid_vago & em_vago & fim_final.isna()), hoje)
        fim_final = fim_final.fillna(hoje)

        vacancia_dias = (fim_final - vago_desde).dt.days
        vacancia_validos = valid_vago & vacancia_dias.notna() & (vacancia_dias >= 0)
        if vacancia_validos.any():
            tempo_medio_vacancia_dias = float(vacancia_dias[vacancia_validos].mean())
    else:
        warnings.append("Coluna dataVagoDesde nao encontrada para tempo medio de vacancia.")

    return {
        "periodo": {
            "inicio": start.date().isoformat(),
            "fim": end.date().isoformat(),
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
            "tempo_medio_vacancia": {
                "id": "6",
                "dias": tempo_medio_vacancia_dias,
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
