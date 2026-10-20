import os
from datetime import datetime, timezone

import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Caça Ofertas API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["GET"],
    allow_headers=["*"],
)
SERPAPI_KEY = os.getenv("SERPAPI_KEY", "").strip()


@app.get("/health")
def health():
    return {"status": "ok", "provider_configured": bool(SERPAPI_KEY)}


@app.get("/api/search")
def search(
    q: str = Query(min_length=2, max_length=180),
    cep: str = "",
    free_shipping: bool = False,
    include_coupons: bool = True,
    sort_total: bool = True,
):
    if not SERPAPI_KEY:
        raise HTTPException(
            status_code=503,
            detail="Busca não configurada: defina SERPAPI_KEY no servidor.",
        )

    params = {
        "engine": "google_shopping",
        "q": q,
        "google_domain": "google.com.br",
        "gl": "br",
        "hl": "pt",
        "api_key": SERPAPI_KEY,
    }
    try:
        response = requests.get(
            "https://serpapi.com/search.json", params=params, timeout=25
        )
        response.raise_for_status()
        raw = response.json().get("shopping_results", [])
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Falha na fonte de busca: {exc.__class__.__name__}",
        )

    now = datetime.now(timezone.utc).astimezone().strftime("%d/%m/%Y %H:%M")
    offers = []
    for item in raw:
        price = item.get("extracted_price")
        delivery = (item.get("delivery") or "").lower()
        shipping_status = (
            "free"
            if any(
                term in delivery
                for term in ["free delivery", "frete grátis", "frete gratis"]
            )
            else ("paid" if delivery else "unknown")
        )
        if free_shipping and shipping_status != "free":
            continue
        offers.append(
            {
                "title": item.get("title"),
                "merchant": item.get("source"),
                "price": price,
                "total_price": (
                    price
                    if shipping_status == "free" and price is not None
                    else None
                ),
                "shipping_status": shipping_status,
                "coupon": None,
                "url": item.get("product_link") or item.get("link"),
                "checked_at": now,
                "source": "Google Shopping via SerpApi",
            }
        )

    if sort_total:
        offers.sort(
            key=lambda offer: (
                offer["total_price"] is None,
                offer["total_price"]
                if offer["total_price"] is not None
                else (
                    offer["price"]
                    if offer["price"] is not None
                    else float("inf")
                ),
            )
        )

    coupons = []
    if include_coupons:
        coupon_query = (
            f"{q} cupom desconto promoção "
            "site:promobit.com.br OR site:pelando.com.br"
        )
        try:
            coupon_response = requests.get(
                "https://serpapi.com/search.json",
                params={
                    "engine": "google",
                    "q": coupon_query,
                    "google_domain": "google.com.br",
                    "gl": "br",
                    "hl": "pt",
                    "api_key": SERPAPI_KEY,
                },
                timeout=20,
            )
            coupon_response.raise_for_status()
            for result in coupon_response.json().get("organic_results", [])[:8]:
                description = result.get("title", "Possível página de promoção")
                if result.get("snippet"):
                    description += " — " + result["snippet"]
                coupons.append(
                    {
                        "code": None,
                        "description": description,
                        "status": (
                            "Resultado de busca; cupom e validade não confirmados"
                        ),
                        "url": result.get("link"),
                    }
                )
        except requests.RequestException:
            pass

    return {
        "query": q,
        "cep_used": bool(cep),
        "offers": offers,
        "coupons": coupons,
        "notes": [
            "Frete e preço total dependem dos dados disponibilizados pela fonte e podem variar por CEP.",
            "Cupons encontrados em páginas públicas não são considerados válidos até serem testados na loja.",
        ],
    }
