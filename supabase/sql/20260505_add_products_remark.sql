-- Add remark field for additional product details from StockPage modal
alter table public.products
add column if not exists remark text;

-- Backfill existing data so old description appears in remark
update public.products
set remark = description
where remark is null
  and description is not null;
