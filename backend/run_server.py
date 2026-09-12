
import uvicorn
from main import app
from routers.ingestion import router as ingestion_router
app.include_router(ingestion_router)

if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=8000)
