import logging
from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from api.lib import (
    ALLOWED_TYPES,
    PREVIEW_LIMIT,
    DATASETS,
    normalize_dataframe,
    parse_xls,
    to_json_safe,
    infer_type,
    parse_filter_dates,
    build_locacao_metrics,
)

app = FastAPI()
logger = logging.getLogger("upload_api")
logging.basicConfig(level=logging.INFO)


@app.post("/")
@app.post("/api/upload")
async def upload(file: UploadFile = File(...), type: str = Form(...)):
    logger.info("Requisicao recebida. filename=%s type=%s", file.filename, type)

    normalized_type = (type or "").strip().lower()

    if not normalized_type:
        inferred = infer_type(file.filename)
        normalized_type = inferred or ""

    if normalized_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Tipo de planilha invalido. Use contratos, imoveis ou atendimentos.",
        )

    if not file.filename:
        raise HTTPException(status_code=400, detail="Arquivo nao informado.")

    if not file.filename.lower().endswith(".xls"):
        raise HTTPException(status_code=400, detail="Somente arquivos .xls sao aceitos.")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")

    try:
        parsed = parse_xls(raw)
    except Exception as exc:
        logger.exception("Falha no parsing do arquivo: %s", file.filename)
        raise HTTPException(
            status_code=422,
            detail=f"Falha ao processar planilha .xls: {exc}",
        ) from exc

    try:
        normalized = normalize_dataframe(parsed)
        raw_records = normalized.to_dict(orient="records")
        records = [
            {str(column): to_json_safe(cell) for column, cell in row.items()}
            for row in raw_records
        ]
    except Exception as exc:
        logger.exception("Falha na normalizacao/serializacao do arquivo: %s", file.filename)
        raise HTTPException(
            status_code=422,
            detail=f"Falha ao normalizar/serializar planilha: {exc}",
        ) from exc

    logger.info(
        "Upload processado com sucesso. type=%s filename=%s rows=%s cols=%s",
        normalized_type,
        file.filename,
        len(records),
        len(normalized.columns),
    )

    DATASETS[normalized_type] = normalized

    return {
        "success": True,
        "metadata": {
            "type": normalized_type,
            "filename": file.filename,
            "rows": len(records),
            "columns": len(normalized.columns),
            "originalColumns": [str(col) for col in parsed.columns],
            "normalizedColumns": list(normalized.columns),
        },
        "preview": records[:PREVIEW_LIMIT],
        "records": records,
    }


@app.get("/api/locacao/metrics")
async def locacao_metrics(start_date: str, end_date: str):
    logger.info("Requisicao de metricas de locacao. start=%s end=%s", start_date, end_date)
    try:
        start, end = parse_filter_dates(start_date, end_date)
        payload = build_locacao_metrics(start, end)
        logger.info("Metricas de locacao calculadas com sucesso.")
        return {"success": True, **payload}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Erro ao calcular metricas de locacao")
        raise HTTPException(status_code=500, detail="Erro interno ao processar metricas") from exc
