"""Vercel serverless handler for file uploads."""

from io import BytesIO
import json
import logging

from lib import (
    ALLOWED_TYPES,
    PREVIEW_LIMIT,
    DATASETS,
    normalize_dataframe,
    parse_xls,
    to_json_safe,
    infer_type,
)

logger = logging.getLogger("upload_handler")
logging.basicConfig(level=logging.INFO)


async def handler(request, response):
    """Vercel serverless function for file uploads."""
    if request.method != "POST":
        response.status_code = 405
        return {"error": "Method not allowed"}

    try:
        # Parse multipart form data
        import asyncio
        from urllib.parse import parse_qs
        
        body = await request.body() if hasattr(request, 'body') else request.get_data()
        file_type = request.form.get("type", "") if hasattr(request, 'form') else ""
        
        # For serverless, form data parsing is different
        # This is a simplified version - you may need to adjust based on Vercel's request format
        
        logger.info("Upload request received")
        
        # Placeholder implementation
        return {
            "success": False,
            "error": "Serverless upload not fully configured yet. Use development server.",
        }
        
    except Exception as exc:
        logger.exception("Error in upload handler")
        response.status_code = 500
        return {"error": str(exc)}
