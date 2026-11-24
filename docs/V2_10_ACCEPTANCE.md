# V2.10 acceptance checklist

| Gate | Evidence or remaining acceptance |
| --- | --- |
| Preserve repository | Private verified checkpoint before development |
| Authoritative Create and Join seat recovery | Transport session descriptor, client reconciliation and room queue checks |
| Distinct join errors | Format, unavailable code, started match, full lobby and seat ownership |
| Lobby, completed and active-casual release | Existing release path and restart regressions retained |
| Ranked assignment | Four authenticated players assigned correctly in Chromium and Firefox. A seeded full match passed at the service layer. Ranked browser play through results remains open. |
| Consistent UI | Tropical panel styling extends to profile, settings and tutorial. Full screen-by-screen visual acceptance remains open. |
| Approved design rules | The referenced upload was unavailable through the repository and connected search. No substitute file was created. |
| Accessibility and responsive widths | Targeted browser checks. Full WCAG 2.2 AA and physical-device acceptance remain open. |
| English, Sinhala and Tamil | Targeted corrections. Complete review and Tamil coverage remain open. |
| Required end-to-end scenarios | Four authenticated Chromium clients completed nine casual hands, saw the match result, and started a rematch. Dedicated SQLite recovery tests passed. The end-to-end browser journey spanning process restart remains open. |
| Automated inventory | [325 distinct passing cases](V2_10_TEST_INVENTORY.csv) across 287 Vitest, 15 infrastructure, and 23 Playwright scenarios. The 1,200-case gate remains open. |
| Production and safety | No production changes or resource provisioning. Existing policy gates retained. |
