-- =============================================================================
-- CASCADE DELETE: Products with zero stock + all associated history/records
-- =============================================================================
-- Targets products where total inventory balance quantity = 0 (or no balance rows).
-- Deletes in dependency order to avoid FK conflicts, then removes the products.
-- SAFE: wrapped in a transaction — review the preview CTE before committing.
-- =============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. IDENTIFY ZERO-STOCK PRODUCTS
-- ----------------------------------------------------------------------------
-- Products where the sum of all inventory_balance quantities is 0 or NULL
-- (i.e. no stock anywhere in the warehouse).
-- ----------------------------------------------------------------------------

WITH zero_stock_products AS (
    SELECT p.id AS product_id, p.sku, p.name
    FROM public.products p
    LEFT JOIN public.inventory_balances ib ON ib.product_id = p.id
    GROUP BY p.id, p.sku, p.name
    HAVING COALESCE(SUM(ib.quantity), 0) = 0
),

-- Preview: uncomment the SELECT below to inspect before committing
-- SELECT * FROM zero_stock_products;

-- ----------------------------------------------------------------------------
-- 2. NULLIFY soft-references (SET NULL FKs that block or dirty the delete)
-- ----------------------------------------------------------------------------

nullify_cycle_count_lines AS (
    UPDATE public.cycle_count_lines ccl
    SET product_id = NULL
    FROM zero_stock_products zsp
    WHERE ccl.product_id = zsp.product_id
    RETURNING ccl.id
),

nullify_staging_loads AS (
    UPDATE public.staging_loads sl
    SET product_id = NULL
    FROM zero_stock_products zsp
    WHERE sl.product_id = zsp.product_id
    RETURNING sl.id
),

nullify_replenishment_tasks AS (
    UPDATE public.replenishment_tasks rt
    SET product_id = NULL
    FROM zero_stock_products zsp
    WHERE rt.product_id = zsp.product_id
    RETURNING rt.id
),

nullify_ai_recommendations AS (
    UPDATE public.ai_recommendations ar
    SET product_id = NULL
    FROM zero_stock_products zsp
    WHERE ar.product_id = zsp.product_id
    RETURNING ar.id
),

-- ----------------------------------------------------------------------------
-- 3. DELETE RESTRICT-FK children in bottom-up order
-- ----------------------------------------------------------------------------

-- stock_adjustments → inventory_balances → pallets → receipt_lines
del_stock_adjustments AS (
    DELETE FROM public.stock_adjustments sa
    USING public.inventory_balances ib
    JOIN zero_stock_products zsp ON ib.product_id = zsp.product_id
    WHERE sa.inventory_balance_id = ib.id
       OR sa.pallet_id IN (
           SELECT id FROM public.pallets p2
           WHERE p2.product_id = zsp.product_id
       )
    RETURNING sa.id
),

del_transfer_lines AS (
    DELETE FROM public.transfer_lines tl
    USING zero_stock_products zsp
    WHERE tl.product_id = zsp.product_id
    RETURNING tl.id
),

del_order_lines AS (
    DELETE FROM public.order_lines ol
    USING zero_stock_products zsp
    WHERE ol.product_id = zsp.product_id
    RETURNING ol.id
),

del_receipt_lines AS (
    DELETE FROM public.receipt_lines rl
    USING zero_stock_products zsp
    WHERE rl.product_id = zsp.product_id
    RETURNING rl.id
),

del_inventory_balances AS (
    DELETE FROM public.inventory_balances ib
    USING zero_stock_products zsp
    WHERE ib.product_id = zsp.product_id
    RETURNING ib.id
),

-- putaway_tasks and move_tasks cascade from pallets — delete pallets last
-- but first null out any FK children that SET NULL won't cover automatically
del_putaway_tasks AS (
    DELETE FROM public.putaway_tasks pt
    USING public.pallets p
    JOIN zero_stock_products zsp ON p.product_id = zsp.product_id
    WHERE pt.pallet_id = p.id
    RETURNING pt.id
),

del_move_tasks AS (
    DELETE FROM public.move_tasks mt
    USING public.pallets p
    JOIN zero_stock_products zsp ON p.product_id = zsp.product_id
    WHERE mt.pallet_id = p.id
    RETURNING mt.id
),

del_pallets AS (
    DELETE FROM public.pallets p
    USING zero_stock_products zsp
    WHERE p.product_id = zsp.product_id
    RETURNING p.id
),

-- inventory_lots cascade from products (on delete cascade) — explicit for safety
del_inventory_lots AS (
    DELETE FROM public.inventory_lots il
    USING zero_stock_products zsp
    WHERE il.product_id = zsp.product_id
    RETURNING il.id
),

-- product_packaging_profiles cascade from products (on delete cascade)
del_packaging_profiles AS (
    DELETE FROM public.product_packaging_profiles ppp
    USING zero_stock_products zsp
    WHERE ppp.product_id = zsp.product_id
    RETURNING ppp.id
),

-- ----------------------------------------------------------------------------
-- 4. DELETE THE PRODUCTS
-- ----------------------------------------------------------------------------

del_products AS (
    DELETE FROM public.products p
    USING zero_stock_products zsp
    WHERE p.id = zsp.product_id
    RETURNING p.id, p.sku, p.name
)

-- ----------------------------------------------------------------------------
-- 5. SUMMARY REPORT
-- ----------------------------------------------------------------------------
SELECT
    dp.sku,
    dp.name,
    (SELECT COUNT(*) FROM del_stock_adjustments)   AS stock_adjustments_deleted,
    (SELECT COUNT(*) FROM del_transfer_lines)       AS transfer_lines_deleted,
    (SELECT COUNT(*) FROM del_order_lines)          AS order_lines_deleted,
    (SELECT COUNT(*) FROM del_receipt_lines)        AS receipt_lines_deleted,
    (SELECT COUNT(*) FROM del_inventory_balances)   AS inventory_balances_deleted,
    (SELECT COUNT(*) FROM del_putaway_tasks)        AS putaway_tasks_deleted,
    (SELECT COUNT(*) FROM del_move_tasks)           AS move_tasks_deleted,
    (SELECT COUNT(*) FROM del_pallets)              AS pallets_deleted,
    (SELECT COUNT(*) FROM del_inventory_lots)       AS inventory_lots_deleted,
    (SELECT COUNT(*) FROM del_packaging_profiles)   AS packaging_profiles_deleted
FROM del_products dp;

-- ----------------------------------------------------------------------------
-- Review the summary above.
-- If everything looks correct → COMMIT;
-- If something looks wrong  → ROLLBACK;
-- ----------------------------------------------------------------------------

-- COMMIT;
-- ROLLBACK;
