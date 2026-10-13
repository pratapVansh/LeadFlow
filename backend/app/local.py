import uvicorn

from .database import port


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=port("BACKEND_PORT"), reload=True)
