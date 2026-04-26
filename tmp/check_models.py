
import asyncio
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.ml_model import MLModel

async def check_models():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        result = await session.execute(select(MLModel).order_by(MLModel.created_at.desc()).limit(10))
        models = result.scalars().all()
        
        print(f"--- RECENT MODELS ---")
        for m in models:
            print(f"ID: {m.id}")
            print(f"Name: {m.name}")
            print(f"Status: {m.status}")
            print(f"Path: {m.storage_path}")
            print(f"ONNX: {m.onnx_path}")
            print(f"Created: {m.created_at}")
            print("-" * 20)

if __name__ == "__main__":
    asyncio.run(check_models())
