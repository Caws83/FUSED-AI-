# Fused AI Trending

This is **Fused AI Trending**, not X’s ranking.

Given real `SocialPost` rows:

```
engagement = likes + 2*replies + 2*reposts + 3*quotes + 0.001*views
             (missing metrics count as 0 in the formula only)

ageHours   = hours since publishedAt (minimum 1 minute)

velocity   = engagement / ageHours
recency    = exp(-ageHours / 24)
totals     = log1p(engagement)
priority   = tracked-account priority / 10000

score = wV*velocity + wR*recency + wT*totals + wP*priority
```

Weights (env, not UI constants):

| Variable | Default |
|----------|---------|
| `TRENDING_VELOCITY_WEIGHT` | 0.45 |
| `TRENDING_RECENCY_WEIGHT` | 0.25 |
| `TRENDING_TOTALS_WEIGHT` | 0.30 |
| `TRENDING_PRIORITY_WEIGHT` | 0.10 |

Missing metrics are not shown as invented numbers. `/trending` stays empty until
the provider returns real posts.
