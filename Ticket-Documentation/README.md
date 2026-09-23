# Ticket Documentation — 10 Completed INC Tickets

One study document per ticket, taken from `CR Ticket Tracker - Template - Copy (1).xlsx`. The tracker gives the requirement; the actual project source code is the source of truth for what was implemented. Every document follows the same 12 sections:

1. Ticket Overview  2. Understanding the Ticket  3. Existing Problem  4. Root Cause  5. Solution  6. Implementation Details  7. Execution Flow  8. Important Files Changed  9. Important Code Changes  10. Before vs After  11. Testing  12. Final Result

| Ticket | Category | Description | Documentation |
| --- | --- | --- | --- |
| INC0010070 | Validation | Mobile Number | [INC0010070-Mobile-Number-Validation.md](INC0010070-Mobile-Number-Validation.md) |
| INC0010075 | Validation | Password Validation | [INC0010075-Password-Validation.md](INC0010075-Password-Validation.md) |
| INC0010077 | UI | Dropdown Arrow | [INC0010077-Dropdown-Arrow-UI.md](INC0010077-Dropdown-Arrow-UI.md) |
| INC0010078 | UI | Password Visibility | [INC0010078-Password-Visibility-Toggle.md](INC0010078-Password-Visibility-Toggle.md) |
| INC0010079 | Validation | Postal Code | [INC0010079-Postal-Code-Validation.md](INC0010079-Postal-Code-Validation.md) |
| INC0010080 | Data Display | Settlement Business Value | [INC0010080-Settlement-Business-Value.md](INC0010080-Settlement-Business-Value.md) |
| INC0010081 | Enhancement | Role & Status Filters | [INC0010081-User-Account-Filters.md](INC0010081-User-Account-Filters.md) |
| INC0010082 | Synchronization | User Status | [INC0010082-User-Status-Synchronization.md](INC0010082-User-Status-Synchronization.md) |
| INC0010083 | Business Logic | Zone-Based Filtering | [INC0010083-Zone-Based-Ops-Manager-Filtering.md](INC0010083-Zone-Based-Ops-Manager-Filtering.md) |
| INC0010084 | Synchronization | Product Category & Tax | [INC0010084-Product-Category-Tax-Synchronization.md](INC0010084-Product-Category-Tax-Synchronization.md) |

## Shared building blocks (used by several tickets)

| Building block | Used by |
| --- | --- |
| `frontend/src/app/core/validation/input-rules.ts` (mobile, postal rules) | INC0010070, INC0010079 |
| `frontend/src/app/shared/input-rules/digits-only.directive.ts` | INC0010070, INC0010079 |
| `frontend/src/app/core/validation/password-policy.ts`, `shared/password-requirements` | INC0010075 |
| S1 `validation/MobileNumberRule`, `validation/PasswordPolicy` | INC0010070, INC0010075 |
| Shared `.select` class in `frontend/src/styles.scss` | INC0010077 (and the dropdowns of INC0010081, INC0010083, INC0010084) |
| S1 `OperationsManagerStatusSync` | INC0010082 |
| S6 `TaxCalculationService`, S3 `CheckoutServiceImpl` | INC0010084 |

## Notes

- Services: **S1** platform/accounts/territory, **S2** partner verification, **S3** commerce/customer, **S4** orders/logistics, **S5** fleet, **S6** finance/support/tax.
- No database connection settings or credentials are reproduced in these documents; none are needed to explain the tickets.
- Verification done for the implementation: Angular dev and production builds pass; S1, S3 and S4 unit tests pass; S6 unit tests pass (its `@SpringBootTest` context test needs the remote database and cannot run offline). Documented test cases in each file are practical manual scenarios; they were not all executed end to end in a running environment, apart from a browser check of the register page (mobile digits, live password checklist, single toggle) and of the dropdown arrow.

## Test files and main code location

Every document ends with a **Test Files Created** section (the backend test files that belong to it, or a note that no backend code changed) and a **Main Code Location** section. The main place is marked in the source code by a banner comment of the form `TK_<ticket id>_<name>_<employee id(s)>` (for example `TK_INC0010079_Postal_Code_Validation_3248237`).
