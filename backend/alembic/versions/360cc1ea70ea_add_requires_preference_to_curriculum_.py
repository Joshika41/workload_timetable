"""add_requires_preference_to_curriculum_offerings

Revision ID: 360cc1ea70ea
Revises: 18aedd9497d3
Create Date: 2026-10-12 00:51:52.383866

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '360cc1ea70ea'
down_revision: Union[str, Sequence[str], None] = '18aedd9497d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('curriculum_offerings', sa.Column('requires_preference', sa.Boolean(), server_default='true', nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('curriculum_offerings', 'requires_preference')
