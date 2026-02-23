# Retirement Projection Studio

Plan, compare, and project long-term retirement outcomes using transparent assumptions.

Retirement Projection Studio is a full-stack web application that models savings growth and retirement withdrawals without requiring account linking. It is built for young professionals who want to understand how inflation, return assumptions, and spending choices shape outcomes over long time horizons.

---

## Overview

This app projects:

- Savings accumulation during working years  
- Portfolio drawdown during retirement  
- Nominal and inflation-adjusted balances  
- Conservative, average, and optimistic growth paths  
- Multiple accounts with different tax treatments  
- Custom contribution and spending breakpoints  

Users can explore how changes in assumptions affect outcomes and export full projections to Excel. Results are driven entirely by user inputs.

---

## Why This Exists

Retirement planning spans decades, and a few inputs drive most outcomes. Inflation, returns, retirement length, and spending assumptions compound over time and meaningfully change results.

This tool makes those relationships explicit so you can:

- Sanity-check assumptions before committing to them  
- Compare scenarios side by side  
- See how contributions and spending choices affect long-term balances  

---

## Modeling Framework

### Inflation

- Global inflation assumption  
- Error margin used to generate conservative and optimistic bands  
- Real and nominal views supported throughout  

### Investment Growth

- Nominal annual return assumption  
- Adjustable uncertainty band  
- Scenario-based projections (minimum, average, maximum)  

### Accounts

Each account supports:

- Initial balance  
- Contribution breakpoints  
- Annual contribution growth  
- Tax treatment options:
  - No tax  
  - Tax on entry (Roth-style)  
  - Tax on gains (brokerage-style)  
  - Tax on withdrawal (traditional retirement account)  

### Retirement Spending

- Spending defined in today’s dollars  
- Inflation-adjusted withdrawal modeling  
- Breakpoint-based spending adjustments  
- Flexible retirement duration  

---

## Data Context

The homepage includes benchmark data to anchor planning assumptions. Sources include:

- Boston College Center for Retirement Research  
- Social Security Administration  
- Federal Reserve Survey of Consumer Finances  
- Bureau of Labor Statistics  
- Historical long-run return datasets  

---

## Tech Stack

### Frontend

- React  
- Recharts for visualization  
- Responsive card-based layout  

### Backend

- Flask  
- Pydantic for request validation  
- Deterministic projection engine  

### Exports

- Excel projection download  

Primary endpoint:

```http
POST /api/projection
