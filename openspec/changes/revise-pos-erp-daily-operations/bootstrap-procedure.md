# Named-Account Permission Bootstrap Procedure

**Change:** revise-pos-erp-daily-operations  
**Date:** 2026-09-16  

---

## Purpose
Under the `hpp-access-control` specification:
- An `Admin` role label **does NOT** automatically grant HPP access.
- HPP starts **denied** for every role, including Administrator.
- Managing ordinary users does not permit granting HPP access or self-escalation.
- Grant management requires explicit grant-administration authority (`auth.manageGrants`).
- The initial grant administrator must be established through an audited operational bootstrap identifying the account explicitly, rather than inferred from a role or username.

---

## Bootstrap Procedure

1. **Prerequisites:**
   Ensure the database migrations have been executed (`t_user_grant` and `t_auth_session` created).

2. **Execute Audited Named Bootstrap:**
   Run the bootstrap script identifying the target administrator account by username:
   ```bash
   npx tsx scripts/bootstrap-grants.ts <username>
   ```
   For example, for the initial administrator `admin`:
   ```bash
   npx tsx scripts/bootstrap-grants.ts admin
   ```

3. **What is Granted:**
   - **`auth.manageGrants`**: Granted to the specified account.
   - **`inventory.viewHpp`**: Explicitly **NOT** granted. The user cannot see HPP until granted by a grant administrator.
   - **`reports.viewAllCashiers`**: Explicitly **NOT** granted.

4. **Subsequent Grant Administration:**
   Only accounts with `auth.manageGrants` can call `/api/users/permissions` to grant or revoke:
   - `inventory.viewHpp`
   - `reports.viewAllCashiers`
   - `auth.manageGrants`
   Any self-grant attempt or grant by an ordinary Admin without `auth.manageGrants` is rejected with `403 Forbidden`.
