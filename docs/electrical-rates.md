# Electrical rates (Singapore, 2025)

The **Electrical** tab starts from average rates for electrical works in Singapore homes (HDB and
condo), supply and install, before GST. Each rate sits mid-way in the market range seen in
published Singapore electrician price lists. They live in
`packages/domain/src/electrical/rates.ts`; any rate can be changed in the app for your own
electrician's prices.

Typical ranges they were taken from (S$, supply and install):

| Item                                          | Range       | Average used |
| --------------------------------------------- | ----------- | ------------ |
| Lighting point (switch and wiring)            | 40–80       | 55           |
| Neutral wire to switch point (smart switches) | 35–80       | 50           |
| Putty and make good around light cut-out      | 10–25       | 15           |
| Aluminium LED profile c/w diffuser, per m     | 15–30       | 22           |
| 13A single switched socket (new point)        | 65–120      | 75           |
| 13A twin switched socket (new point)          | 70–130      | 85           |
| Aircon isolator point (20A DP)                | 120–180     | 140          |
| Water heater point (isolator and MCB)         | 120–200     | 160          |
| DB box, 12-way with RCCB and MCBs             | 450–900     | 750          |
| DB upgrade to 18/24-way                       | 700–1,200   | 950          |
| Replace RCCB / ELCB                           | 180–260     | 200          |
| Full rewiring, HDB 4-room                     | 3,000–5,500 | 4,500        |

Sources (checked October 2026):

- https://www.homejourney.sg/blog/electrician-price-singapore-2025-all-service-rates-listed-homejourney
- https://budgetreno.com.sg/singapore-electrical-work-price-list/
- https://singaporevoice.net/blog/electrician-singapore-price-list/
- https://trustelectricians.com/electrical-price-list-singapore/
- https://homegenie.com.sg/blogs/news/bto-electrical-works-cost-singapore-2026
- https://www.yongjinelectrical.sg/articles/how-much-does-electrical-work-cost

Concealed wiring, access, ceiling height and the site move real quotes up or down. All works must
be done by an EMA-licensed electrical worker (LEW).
