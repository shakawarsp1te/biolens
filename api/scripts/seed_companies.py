"""
Loads app/seed_data/companies.py into the real company store
(app/services/company_store.py), validating each entry against
CompanyProfileModel first so a shape mistake fails loudly here rather than
silently reaching the API.

Usage (from api/):
    python -m scripts.seed_companies
"""

from __future__ import annotations

import asyncio

from app.models.company import CompanyProfileModel
from app.seed_data.companies import COMPANIES
from app.services.company_store import get_company_store


async def main() -> None:
    store = get_company_store()
    for raw in COMPANIES:
        validated = CompanyProfileModel(**raw)  # raises loudly on any shape mistake
        await store.upsert_company(validated.model_dump())
        print(f"seeded: {validated.name} ({validated.id})")
    total = await store.count()
    print(f"\n{total} companies in the store.")


if __name__ == "__main__":
    asyncio.run(main())
