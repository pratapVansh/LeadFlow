import logging
from typing import Annotated

from fastapi import Depends, FastAPI, Response
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .database import get_db
from .leads import router

logger = logging.getLogger("leadflow")
app = FastAPI(title="LeadFlow API", version="1.0.0")
app.include_router(router)


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(request, exception: SQLAlchemyError) -> JSONResponse:
    logger.error("Database operation failed", exc_info=exception)
    return JSONResponse(status_code=503, content={"detail": "Database unavailable. Please try again."})


@app.exception_handler(Exception)
async def unexpected_error_handler(request, exception: Exception) -> JSONResponse:
    logger.error("Unexpected server error", exc_info=exception)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong. Please try again."})


@app.get("/api/health", tags=["health"])
def health(response: Response, db: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        response.status_code = 503
        return {"status": "unavailable"}
    return {"status": "ok"}
