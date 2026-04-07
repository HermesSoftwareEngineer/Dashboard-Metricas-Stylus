"""Vercel serverless handler for metrics."""

import json
import logging

from lib import parse_filter_dates, build_locacao_metrics

logger = logging.getLogger("metrics_handler")
logging.basicConfig(level=logging.INFO)


async def handler(request, response):
    """Vercel serverless function for locacao metrics."""
    if request.method != "GET":
        response.status_code = 405
        return {"error": "Method not allowed"}

    try:
        start_date = request.args.get("start_date", "")
        end_date = request.args.get("end_date", "")
        
        logger.info("Metrics request: start=%s, end=%s", start_date, end_date)
        
        start, end = parse_filter_dates(start_date, end_date)
        payload = build_locacao_metrics(start, end)
        
        response.headers["Content-Type"] = "application/json"
        return {"success": True, **payload}
        
    except ValueError as exc:
        response.status_code = 400
        return {"error": str(exc)}
    except Exception as exc:
        logger.exception("Error in metrics handler")
        response.status_code = 500
        return {"error": "Internal server error"}
