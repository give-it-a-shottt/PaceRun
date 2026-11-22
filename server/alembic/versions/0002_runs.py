"""러닝 테이블

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-22
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "runs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mode", sa.String(16), nullable=False),
        sa.Column("config", postgresql.JSONB(), nullable=False),
        sa.Column("plan_label", sa.String(50), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("elapsed_s", sa.Integer(), nullable=False),
        sa.Column("distance_m", sa.Float(), nullable=False),
        sa.Column("avg_pace_s_per_km", sa.Float(), nullable=True),
        sa.Column("counted", sa.Boolean(), nullable=False),
        sa.Column("segments", postgresql.JSONB(), nullable=False),
        sa.Column("route", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("mode IN ('free', 'interval', 'cadence', 'pacemaker')", name="ck_runs_mode"),
        sa.CheckConstraint("elapsed_s >= 0", name="ck_runs_elapsed_s"),
        sa.CheckConstraint("distance_m >= 0", name="ck_runs_distance_m"),
        sa.CheckConstraint("ended_at >= started_at", name="ck_runs_ended_after_started"),
    )
    op.create_index("ix_runs_user_started", "runs", ["user_id", "started_at"])


def downgrade() -> None:
    op.drop_index("ix_runs_user_started", table_name="runs")
    op.drop_table("runs")
