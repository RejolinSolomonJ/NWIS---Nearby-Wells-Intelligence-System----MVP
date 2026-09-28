"""Phase 4: Add needs_review and raw_text_snippet to drilling_events

Revision ID: 002_phase4_review_and_snippet
Revises: 001_phase1_schema
Create Date: 2026-09-28

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '002_phase4_review_and_snippet'
down_revision = '001_phase1_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('drilling_events', sa.Column('needs_review', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('drilling_events', sa.Column('raw_text_snippet', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('drilling_events', 'raw_text_snippet')
    op.drop_column('drilling_events', 'needs_review')
