from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """모든 테이블 모델의 부모. Alembic이 이 메타데이터로 테이블을 안다."""
