"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import * as XLSX from "xlsx";
import ActionFeedback from "../ui/ActionFeedback";
import TablePaginationControls from "../ui/TablePaginationControls";
import { useTablePagination } from "../ui/useTablePagination";

const sizePlaceholder = "เช่น 195/65R15";

type SiteRow = { id: string; code: string; name: string };
type TireBrand = { id: string; name: string };
type TireModel = { id: string; brand_id: string; name: string };
type CarBrand = { id: string; name: string };
type CarModel = {
  id: string;
  brand_id: string;
  name: string;
  car_brands?: { id?: string; name: string } | { id?: string; name: string }[] | null;
};
type CarYear = { model_id: string; year_from: number; year_to: number };
type CustomerGroup = {
  id: string;
  code: string;
  name: string;
};

type StockItem = {
  product_id: string;
  sku_id: string;
  site_id: string;
  site_name: string;
  brand: string;
  name: string;
  description: string;
  remark: string;
  car_models: CarModel[];
  car_brands: CarBrand[];
  sku_code: string;
  size_label: string;
  width_mm: number | null;
  aspect_ratio: number | null;
  rim_inch: number | null;
  cost_price: number;
  qty_on_hand: number;
  min_stock: number;
  group_prices: Record<string, number>;
  group_old_prices: Record<string, number>;
  group_promo_prices: Record<string, number>;
  is_hot: boolean;
  is_new: boolean;
  is_promotion: boolean;
  total_sold: number;
};

type FormState = {
  product_id: string;
  sku_id: string;
  site_id: string;
  brand_id: string;
  model_id: string;
  sku_code: string;
  size_label: string;
  description: string;
  remark: string;
  width_mm: string;
  aspect_ratio: string;
  rim_inch: string;
  cost_price: string;
  qty_on_hand: string;
  min_stock: string;
  images: string[];
  car_brand_filter_ids: string[];
  car_model_ids: string[];
  group_prices: Record<string, string>;
  group_old_prices: Record<string, string>;
  group_promo_prices: Record<string, string>;
  is_hot: boolean;
  is_new: boolean;
  is_promotion: boolean;
  total_sold: string;
};

type FormErrors = Partial<
  Record<
    | "site_id"
    | "brand_id"
    | "model_id"
    | "sku_code"
    | "size_label"
    | "cost_price"
    | "qty_on_hand"
    | "min_stock",
    string
  >
>;

type MovementAuditRow = {
  id: string;
  movement_type: string;
  qty_change: number;
  ref_type: string | null;
  ref_id: string | null;
  note: string | null;
  created_at: string;
  skus?: {
    sku_code: string | null;
    size_label: string | null;
    products?: { brand: string | null; name: string | null } | null;
  } | null;
};

type ImageSearchResult = {
  sku_id: string;
  image_url: string | null;
  sku_code: string | null;
  size_label: string | null;
  brand: string | null;
  name: string | null;
  score: number;
  match_type: string;
};

const emptyForm: FormState = {
  product_id: "",
  sku_id: "",
  site_id: "",
  brand_id: "",
  model_id: "",
  sku_code: "",
  size_label: "",
  description: "",
  remark: "",
  width_mm: "",
  aspect_ratio: "",
  rim_inch: "",
  cost_price: "",
  qty_on_hand: "",
  min_stock: "",
  images: [],
  car_brand_filter_ids: [],
  car_model_ids: [],
  group_prices: {},
  group_old_prices: {},
  group_promo_prices: {},
  is_hot: false,
  is_new: false,
  is_promotion: false,
  total_sold: ""
};

export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [tireBrands, setTireBrands] = useState<TireBrand[]>([]);
  const [tireModels, setTireModels] = useState<TireModel[]>([]);
  const [carBrands, setCarBrands] = useState<CarBrand[]>([]);
  const [carModels, setCarModels] = useState<CarModel[]>([]);
  const [carYears, setCarYears] = useState<CarYear[]>([]);
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [filterSite, setFilterSite] = useState("all");
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [sizeWidth, setSizeWidth] = useState("");
  const [sizeAspect, setSizeAspect] = useState("");
  const [sizeRim, setSizeRim] = useState("");
  const [carMake, setCarMake] = useState("");
  const [carModel, setCarModel] = useState("");
  const [carYear, setCarYear] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [imageMap, setImageMap] = useState<Record<string, string[]>>({});
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<StockItem | null>(null);
  const [movementAudits, setMovementAudits] = useState<MovementAuditRow[]>([]);
  const [imageSearchOpen, setImageSearchOpen] = useState(false);
  const [imageSearchFile, setImageSearchFile] = useState<File | null>(null);
  const [imageSearchPreview, setImageSearchPreview] = useState<string | null>(null);
  const [imageSearchLoading, setImageSearchLoading] = useState(false);
  const [imageSearchMessage, setImageSearchMessage] = useState<string | null>(null);
  const [imageSearchResults, setImageSearchResults] = useState<ImageSearchResult[]>([]);

  useEffect(() => {
    if (!supabase) {
      setError("กรุณาตั้งค่า NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY");
      return;
    }
    loadSites();
    loadTireCatalog();
    loadCarCatalog();
    loadCustomerGroups();
    loadItems();
    loadMovementAudits();
  }, []);

  useEffect(() => {
    return () => {
      if (imageSearchPreview) URL.revokeObjectURL(imageSearchPreview);
    };
  }, [imageSearchPreview]);

  async function loadSites() {
    if (!supabase) return;
    const { data } = await supabase.from("sites").select("id,code,name").order("name");
    if (data) setSites(data as SiteRow[]);
  }

  async function loadTireCatalog() {
    if (!supabase) return;
    const [brandRes, modelRes] = await Promise.all([
      supabase.from("tire_brands").select("id,name").order("name"),
      supabase.from("tire_models").select("id,brand_id,name").order("name")
    ]);
    if (brandRes.data) setTireBrands(brandRes.data as TireBrand[]);
    if (modelRes.data) setTireModels(modelRes.data as TireModel[]);
  }

  async function loadCarCatalog() {
    if (!supabase) return;
    const [brandRes, modelRes, yearRes] = await Promise.all([
      supabase.from("car_brands").select("id,name").order("name"),
      supabase.from("car_models").select("id,brand_id,name,car_brands(name)").order("name"),
      supabase.from("car_years").select("model_id,year_from,year_to").order("year_from")
    ]);
    if (brandRes.data) setCarBrands(brandRes.data as CarBrand[]);
    if (modelRes.data) setCarModels(modelRes.data as CarModel[]);
    if (yearRes.data) setCarYears(yearRes.data as CarYear[]);
  }

  async function loadCustomerGroups() {
    if (!supabase) return;
    const { data, error: groupError } = await supabase
      .from("customer_groups")
      .select("id,code,name")
      .order("created_at", { ascending: true });
    if (groupError) {
      setError(groupError.message);
      return;
    }
    setCustomerGroups((data ?? []) as CustomerGroup[]);
  }

  function buildEmptyGroupPrices(groups: CustomerGroup[]) {
    return groups.reduce<Record<string, string>>((acc, group) => {
      acc[group.id] = "";
      return acc;
    }, {});
  }

  function buildEmptyGroupOldPrices(groups: CustomerGroup[]) {
    return groups.reduce<Record<string, string>>((acc, group) => {
      acc[group.id] = "";
      return acc;
    }, {});
  }

  /**
   * Build an empty promotion-price map keyed by customer group id.
   * @param groups customer groups to include
   * @returns record of group id to empty string
   */
  function buildEmptyGroupPromoPrices(groups: CustomerGroup[]) {
    return groups.reduce<Record<string, string>>((acc, group) => {
      acc[group.id] = "";
      return acc;
    }, {});
  }

  /**
   * Validate promotion prices per group: must be a non-negative number
   * and lower than the normal selling price of the same group.
   * @param nextForm form state to validate
   * @returns error message, or null when valid
   */
  function validatePromoPrices(nextForm: FormState): string | null {
    for (const group of customerGroups) {
      const promoRaw = (nextForm.group_promo_prices[group.id] ?? "").replace(/,/g, "").trim();
      if (!promoRaw) continue;
      const promo = Number(promoRaw);
      if (!Number.isFinite(promo) || promo < 0) return `ราคาโปรโมชั่นกลุ่ม ${group.name} ไม่ถูกต้อง`;
      const priceRaw = (nextForm.group_prices[group.id] ?? "").replace(/,/g, "").trim();
      if (!priceRaw) return `กรุณากรอกราคาขายกลุ่ม ${group.name} ก่อนกำหนดราคาโปรโมชั่น`;
      const price = Number(priceRaw);
      if (Number.isFinite(price) && promo >= price) {
        return `ราคาโปรโมชั่นกลุ่ม ${group.name} ต้องต่ำกว่าราคาขาย`;
      }
    }
    return null;
  }

  async function loadItems() {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("skus")
      .select(
        "id,sku_code,size_label,width_mm,aspect_ratio,rim_inch,cost_price,products(id,site_id,brand,name,description,remark,is_hot,is_new,is_promotion,total_sold,sites(name)),inventory(qty_on_hand,min_stock)"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const skuIds = (data ?? []).map((row: any) => row.id).filter(Boolean);
    let priceMap = new Map<string, Record<string, number>>();
    let oldPriceMap = new Map<string, Record<string, number>>();
    let promoPriceMap = new Map<string, Record<string, number>>();
    if (skuIds.length) {
      const { data: pricesData, error: pricesError } = await supabase
        .from("prices")
        .select("sku_id,group_id,price,old_price,promo_price")
        .in("sku_id", skuIds);
      if (pricesError) {
        setError(pricesError.message);
      } else {
        (pricesData ?? []).forEach((row: any) => {
          const entry = priceMap.get(row.sku_id) || {};
          entry[row.group_id] = Number(row.price ?? 0);
          priceMap.set(row.sku_id, entry);
          const oldEntry = oldPriceMap.get(row.sku_id) || {};
          if (row.old_price != null) oldEntry[row.group_id] = Number(row.old_price ?? 0);
          oldPriceMap.set(row.sku_id, oldEntry);
          const promoEntry = promoPriceMap.get(row.sku_id) || {};
          if (row.promo_price != null) promoEntry[row.group_id] = Number(row.promo_price);
          promoPriceMap.set(row.sku_id, promoEntry);
        });
      }
    }

    const productIds = Array.from(
      new Set((data ?? []).map((row: any) => row.products?.id).filter(Boolean))
    );

    const { data: fitments, error: fitmentError } = await supabase
      .from("product_car_models")
      .select("product_id,car_models(id,name,car_brands(id,name))")
      .in("product_id", productIds);
    if (fitmentError) {
      setError(fitmentError.message);
    }

    const fitmentMap = new Map<string, CarModel[]>();
    const brandMap = new Map<string, CarBrand[]>();
    (fitments ?? []).forEach((row: any) => {
      const list = fitmentMap.get(row.product_id) || [];
      if (row.car_models) list.push(row.car_models);
      fitmentMap.set(row.product_id, list);

      const b = row.car_models?.car_brands;
      const brandObj = Array.isArray(b) ? b[0] : b;
      if (brandObj) {
        const brands = brandMap.get(row.product_id) || [];
        if (!brands.find((x) => x.id === brandObj.id)) {
          brands.push({ id: brandObj.id, name: brandObj.name });
        }
        brandMap.set(row.product_id, brands);
      }
    });

    const mapped: StockItem[] = (data ?? []).map((row: any) => ({
      product_id: row.products.id,
      sku_id: row.id,
      site_id: row.products.site_id,
      site_name: row.products.sites?.name || "-",
      brand: row.products.brand,
      name: row.products.name,
      car_models: fitmentMap.get(row.products.id) || [],
      car_brands: brandMap.get(row.products.id) || [],
      sku_code: row.sku_code,
      size_label: row.size_label || "",
      description: row.products?.description ?? "",
      remark: row.products?.remark ?? "",
      width_mm: row.width_mm ?? null,
      aspect_ratio: row.aspect_ratio ?? null,
      rim_inch: row.rim_inch ?? null,
      cost_price: Number(row.cost_price || 0),
      qty_on_hand: row.inventory?.qty_on_hand ?? 0,
      min_stock: row.inventory?.min_stock ?? 0,
      group_prices: priceMap.get(row.id) || {},
      group_old_prices: oldPriceMap.get(row.id) || {},
      group_promo_prices: promoPriceMap.get(row.id) || {},
      is_hot: Boolean(row.products?.is_hot),
      is_new: Boolean(row.products?.is_new),
      is_promotion: Boolean(row.products?.is_promotion),
      total_sold: Number(row.products?.total_sold ?? 0)
    }));

    setItems(mapped);
    await loadSkuImages(mapped.map((item) => item.sku_id));
    setLoading(false);
  }

  async function loadMovementAudits() {
    if (!supabase) return;
    const { data, error: movementError } = await supabase
      .from("inventory_movements")
      .select(
        "id,movement_type,qty_change,ref_type,ref_id,note,created_at,skus(sku_code,size_label,products(brand,name))"
      )
      .in("movement_type", ["bonus", "free_issue"])
      .order("created_at", { ascending: false })
      .limit(100);
    if (movementError) {
      setError(movementError.message);
      return;
    }
    setMovementAudits((data ?? []) as unknown as MovementAuditRow[]);
  }

  const brandOptions = useMemo(() => {
    const brands = Array.from(new Set(items.map((i) => i.brand)));
    return brands;
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const siteOk = filterSite === "all" || item.site_id === filterSite;
      const brandOk = filterBrand === "all" || item.brand === filterBrand;
      const statusOk =
        filterStatus === "all" ||
        (filterStatus === "low" && item.qty_on_hand <= item.min_stock) ||
        (filterStatus === "ok" && item.qty_on_hand > item.min_stock);

      const searchOk =
        search.trim().length === 0 ||
        [item.brand, item.name, item.sku_code, item.size_label]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase());

      const sizeParsed = parseSize(item.size_label);
      const widthVal = item.width_mm ?? sizeParsed.width ?? null;
      const aspectVal = item.aspect_ratio ?? sizeParsed.aspect ?? null;
      const rimVal = item.rim_inch ?? sizeParsed.rim ?? null;

      const sizeOk =
        (!sizeWidth || widthVal === Number(sizeWidth)) &&
        (!sizeAspect || aspectVal === Number(sizeAspect)) &&
        (!sizeRim || rimVal === Number(sizeRim));

      const carBrandNames = item.car_models.map((m) => {
        const b = m.car_brands;
        if (Array.isArray(b)) return b[0]?.name || "";
        return b?.name || "";
      });
      const carModelNames = item.car_models.map((m) => m.name);
      const yearMatches =
        carYear.trim().length === 0 ||
        item.car_models.some((m) =>
          carYears
            .filter((y) => y.model_id === m.id)
            .some((y) => Number(carYear) >= y.year_from && Number(carYear) <= y.year_to)
        );

      const carOk =
        (!carMake && !carModel && !carYear) ||
        ((carMake ? carBrandNames.join(" ").toLowerCase().includes(carMake.toLowerCase()) : true) &&
          (carModel ? carModelNames.join(" ").toLowerCase().includes(carModel.toLowerCase()) : true) &&
          yearMatches);

      return siteOk && brandOk && statusOk && searchOk && sizeOk && carOk;
    });
  }, [items, filterSite, filterBrand, filterStatus, search, sizeWidth, sizeAspect, sizeRim, carMake, carModel, carYear]);
  const movementPagination = useTablePagination(movementAudits, 10);
  const itemsPagination = useTablePagination(filteredItems, 10);

  function openCreate() {
    setForm({
      ...emptyForm,
      group_prices: buildEmptyGroupPrices(customerGroups),
      group_old_prices: buildEmptyGroupOldPrices(customerGroups),
      group_promo_prices: buildEmptyGroupPromoPrices(customerGroups)
    });
    setPendingFiles([]);
    setFormErrors({});
    setModalError(null);
    setModalOpen(true);
  }

  async function openEdit(item: StockItem) {
    if (!supabase) return;
    const brandMatch = tireBrands.find((b) => b.name === item.brand);
    const modelMatch = tireModels.find((m) => m.name === item.name);
    const baseGroupPrices = buildEmptyGroupPrices(customerGroups);
    const baseGroupOldPrices = buildEmptyGroupOldPrices(customerGroups);
    const baseGroupPromoPrices = buildEmptyGroupPromoPrices(customerGroups);
    const { data: priceData, error: priceError } = await supabase
      .from("prices")
      .select("group_id,price,old_price,promo_price")
      .eq("sku_id", item.sku_id);
    if (priceError) {
      setModalError(priceError.message);
    }
    const groupPrices = { ...baseGroupPrices };
    const groupOldPrices = { ...baseGroupOldPrices };
    const groupPromoPrices = { ...baseGroupPromoPrices };
    (priceData ?? []).forEach((row: { group_id: string; price: number }) => {
      groupPrices[row.group_id] = String(row.price ?? "");
    });
    (priceData ?? []).forEach((row: { group_id: string; old_price: number | null }) => {
      groupOldPrices[row.group_id] = row.old_price == null ? "" : String(row.old_price);
    });
    (priceData ?? []).forEach((row: { group_id: string; promo_price: number | null }) => {
      groupPromoPrices[row.group_id] = row.promo_price == null ? "" : String(row.promo_price);
    });
    setForm({
      product_id: item.product_id,
      sku_id: item.sku_id,
      site_id: item.site_id,
      brand_id: brandMatch?.id || "",
      model_id: modelMatch?.id || "",
      sku_code: item.sku_code,
      size_label: item.size_label,
      description: item.description || "",
      remark: item.remark || "",
      width_mm: item.width_mm ? String(item.width_mm) : "",
      aspect_ratio: item.aspect_ratio ? String(item.aspect_ratio) : "",
      rim_inch: item.rim_inch ? String(item.rim_inch) : "",
      cost_price: String(item.cost_price ?? ""),
      qty_on_hand: String(item.qty_on_hand ?? ""),
      min_stock: String(item.min_stock ?? ""),
      images: imageMap[item.sku_id] || [],
      car_brand_filter_ids: [],
      car_model_ids: item.car_models.map((m) => m.id),
      group_prices: groupPrices,
      group_old_prices: groupOldPrices,
      group_promo_prices: groupPromoPrices,
      is_hot: item.is_hot,
      is_new: item.is_new,
      is_promotion: item.is_promotion,
      total_sold: String(item.total_sold ?? 0)
    });
    setPendingFiles([]);
    setFormErrors({});
    setModalError(null);
    setModalOpen(true);
  }

  function clearFieldError(field: keyof FormErrors) {
    setFormErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validateForm(nextForm: FormState): FormErrors {
    const nextErrors: FormErrors = {};
    if (!nextForm.site_id) nextErrors.site_id = "กรุณาเลือก Site";
    if (!nextForm.brand_id) nextErrors.brand_id = "กรุณาเลือกยี่ห้อ";
    if (!nextForm.model_id) nextErrors.model_id = "กรุณาเลือกรุ่นยาง";
    if (!nextForm.sku_code.trim()) nextErrors.sku_code = "กรุณากรอก SKU";
    if (!nextForm.size_label.trim()) nextErrors.size_label = "กรุณากรอกขนาดยาง";

    const cost = Number(nextForm.cost_price);
    if (!nextForm.cost_price.trim()) nextErrors.cost_price = "กรุณากรอกราคาทุน";
    else if (!Number.isFinite(cost) || cost < 0) nextErrors.cost_price = "ราคาทุนไม่ถูกต้อง";

  /*   const qty = Number(nextForm.qty_on_hand);
    if (!nextForm.qty_on_hand.trim()) nextErrors.qty_on_hand = "กรุณากรอกจำนวน Stock";
    else if (!Number.isFinite(qty) || qty < 0) nextErrors.qty_on_hand = "จำนวน Stock ไม่ถูกต้อง";
 */
    const min = Number(nextForm.min_stock);
    if (!nextForm.min_stock.trim()) nextErrors.min_stock = "กรุณากรอกจำนวนขั้นต่ำ";
    else if (!Number.isFinite(min) || min < 0) nextErrors.min_stock = "จำนวนขั้นต่ำไม่ถูกต้อง";

    return nextErrors;
  }

  async function handleSave() {
    if (!supabase) return;
    setSaving(true);
    setError(null);
    setModalError(null);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      if (!form.brand_id || !form.model_id || !form.sku_code) {
        const errors = validateForm(form);
        setFormErrors(errors);
        setModalError("กรุณากรอกข้อมูลที่จำเป็นให้ครบ");
        setSaving(false);
        return;
      }

      form.site_id = '1df52c4e-2178-400f-9cd6-cb38cf8549a7';
      const errors = validateForm(form);
      console.log("errors" ,errors);


      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        setModalError("กรุณากรอกข้อมูลที่จำเป็นให้ครบ");
        setSaving(false);
        return;
      }
      setFormErrors({});

      const promoError = validatePromoPrices(form);
      if (promoError) {
        setModalError(promoError);
        setSaving(false);
        return;
      }

      const brandName = tireBrands.find((b) => b.id === form.brand_id)?.name || "";
      const modelName = tireModels.find((m) => m.id === form.model_id)?.name || "";

      const sizeParts = parseSize(form.size_label);
      const widthVal = form.width_mm ? Number(form.width_mm) : sizeParts.width;
      const aspectVal = form.aspect_ratio ? Number(form.aspect_ratio) : sizeParts.aspect;
      const rimVal = form.rim_inch ? Number(form.rim_inch) : sizeParts.rim;
      const sizeLabel =
        widthVal && aspectVal && rimVal ? `${widthVal}/${aspectVal}R${rimVal}` : form.size_label;

      let targetSkuId = form.sku_id;
      if (form.product_id && form.sku_id) {
        await supabase.from("products").update({
          site_id: form.site_id || null,
          brand: brandName,
          name: modelName,
          description: form.description || null,
          remark: form.remark || null,
          is_hot: form.is_hot,
          is_new: form.is_new,
          is_promotion: form.is_promotion,
          total_sold: Number(form.total_sold || 0)
        }).eq("id", form.product_id);

        await supabase.from("skus").update({
          sku_code: form.sku_code,
          size_label: sizeLabel || null,
          width_mm: widthVal,
          aspect_ratio: aspectVal,
          rim_inch: rimVal,
          cost_price: Number(form.cost_price || 0)
        }).eq("id", form.sku_id);

        await supabase.from("inventory").upsert({
          sku_id: form.sku_id,
          qty_on_hand: Number(form.qty_on_hand || 0),
          min_stock: Number(form.min_stock || 0)
        });

        const delRes = await supabase.from("product_car_models").delete().eq("product_id", form.product_id);
        if (delRes.error) throw delRes.error;
        if (form.car_model_ids.length > 0) {
          const rows = form.car_model_ids
            .map((id) => {
              const model = carModels.find((m) => m.id === id);
              return {
                product_id: form.product_id,
                car_model_id: id,
                car_brand_id: model?.brand_id
              };
            })
            .filter((r) => r.car_brand_id);
          const insRes = await supabase.from("product_car_models").insert(rows);
          if (insRes.error) throw insRes.error;
        }

        setImageMap((prev) => ({ ...prev, [form.sku_id]: form.images }));
      } else {
        const productRes = await supabase.from("products").insert({
          site_id: form.site_id || sites[0]?.id || null,
          brand: brandName,
          name: modelName,
          description: form.description || null,
          remark: form.remark || null,
          is_hot: form.is_hot,
          is_new: form.is_new,
          is_promotion: form.is_promotion,
          total_sold: Number(form.total_sold || 0)
        }).select("id").single();

        if (productRes.error) throw productRes.error;

        const skuRes = await supabase.from("skus").insert({
          product_id: productRes.data.id,
          sku_code: form.sku_code,
          size_label: sizeLabel || null,
          width_mm: widthVal,
          aspect_ratio: aspectVal,
          rim_inch: rimVal,
          cost_price: Number(form.cost_price || 0)
        }).select("id").single();

        if (skuRes.error) throw skuRes.error;
        targetSkuId = skuRes.data.id;

        await supabase.from("inventory").insert({
          sku_id: skuRes.data.id,
          qty_on_hand: Number(form.qty_on_hand || 0),
          min_stock: Number(form.min_stock || 0)
        });

        if (form.car_model_ids.length > 0) {
          const rows = form.car_model_ids
            .map((id) => {
              const model = carModels.find((m) => m.id === id);
              return {
                product_id: productRes.data.id,
                car_model_id: id,
                car_brand_id: model?.brand_id
              };
            })
            .filter((r) => r.car_brand_id);
          const insRes = await supabase.from("product_car_models").insert(rows);
          if (insRes.error) throw insRes.error;
        }

        let uploadedUrls: string[] = [];
        if (pendingFiles.length > 0) {
          uploadedUrls = await uploadImages(skuRes.data.id, pendingFiles);
        }
        setImageMap((prev) => ({ ...prev, [skuRes.data.id]: uploadedUrls }));
      }

      const priceRows = customerGroups
        .map((group) => {
          const raw = (form.group_prices[group.id] ?? "").replace(/,/g, "").trim();
          if (!raw) return null;
          const parsed = Number(raw);
          if (!Number.isFinite(parsed) || parsed < 0) return null;
          const oldRaw = (form.group_old_prices[group.id] ?? "").replace(/,/g, "").trim();
          const parsedOld = oldRaw ? Number(oldRaw) : null;
          const promoRaw = (form.group_promo_prices[group.id] ?? "").replace(/,/g, "").trim();
          const parsedPromo = promoRaw ? Number(promoRaw) : null;
          return {
            sku_id: targetSkuId,
            group_id: group.id,
            price: parsed,
            old_price: Number.isFinite(parsedOld as number) ? parsedOld : null,
            promo_price: Number.isFinite(parsedPromo as number) ? parsedPromo : null
          };
        })
        .filter(Boolean) as {
          sku_id: string;
          group_id: string;
          price: number;
          old_price: number | null;
          promo_price: number | null;
        }[];
      if (priceRows.length > 0) {
        const { error: priceUpsertError } = await supabase
          .from("prices")
          .upsert(priceRows, { onConflict: "sku_id,group_id" });
        if (priceUpsertError) throw priceUpsertError;
      }

      setModalOpen(false);
      setForm({
        ...emptyForm,
        group_prices: buildEmptyGroupPrices(customerGroups),
        group_old_prices: buildEmptyGroupOldPrices(customerGroups),
        group_promo_prices: buildEmptyGroupPromoPrices(customerGroups)
      });
      setPendingFiles([]);
      await loadItems();
      setSaveSuccess("บันทึกข้อมูลสำเร็จ");
    } catch (err: any) {
      const message = err?.message || "บันทึกข้อมูลไม่สำเร็จ";
      setModalError(message);
      setSaveError(message);
    }

    setSaving(false);
  }

  async function adjustStock(item: StockItem, delta: number) {
    if (!supabase) return;
    const newQty = Math.max(0, item.qty_on_hand + delta);
    await supabase.from("inventory").upsert({
      sku_id: item.sku_id,
      qty_on_hand: newQty,
      min_stock: item.min_stock
    });
    await loadItems();
  }

  async function handleDelete(item: StockItem) {
    if (!supabase) return;
    if (!confirm("ยืนยันการลบสินค้า?")) return;
    await removeAllImages(item.sku_id);
    await supabase.from("sku_image_embeddings").delete().eq("sku_id", item.sku_id);
    await supabase.from("skus").delete().eq("id", item.sku_id);
    await supabase.from("products").delete().eq("id", item.product_id);
    setImageMap((prev) => {
      const next = { ...prev };
      delete next[item.sku_id];
      return next;
    });
    await loadItems();
  }

  async function onSelectImages(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files);
    if (!supabase) return;
    if (form.sku_id) {
      const uploadedUrls = await uploadImages(form.sku_id, list);
      setForm((prev) => ({ ...prev, images: [...prev.images, ...uploadedUrls] }));
      setImageMap((prev) => ({ ...prev, [form.sku_id]: [...(prev[form.sku_id] || []), ...uploadedUrls] }));
      return;
    }
    const previews = list.map((file) => URL.createObjectURL(file));
    setPendingFiles((prev) => [...prev, ...list]);
    setForm((prev) => ({ ...prev, images: [...prev.images, ...previews] }));
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    onSelectImages(e.dataTransfer.files);
  }

  async function removeImage(idx: number) {
    const url = form.images[idx];
    if (form.sku_id && supabase) {
      const path = getStoragePath(url);
      if (path) {
        await supabase.storage.from("tires").remove([path]);
      }
      setImageMap((prev) => ({
        ...prev,
        [form.sku_id]: (prev[form.sku_id] || []).filter((_, i) => i !== idx)
      }));
    } else {
      const file = pendingFiles[idx];
      if (file) {
        setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
      }
    }
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx)
    }));
  }

  function getStoragePath(url: string) {
    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tires/`;
    if (url.startsWith(base)) return url.slice(base.length);
    return null;
  }

  async function uploadImages(skuId: string, files: File[]) {
    if (!supabase || files.length === 0) return [];
    setUploadingImages(true);
    setError(null);
    const bucket = supabase.storage.from("tires");
    const uploaded: string[] = [];
    try {
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${skuId}/${Date.now()}_${safeName}`;
        const { error: uploadError } = await bucket.upload(path, file, { upsert: true });
        if (uploadError) {
          setError(uploadError.message);
          continue;
        }
        const { data } = bucket.getPublicUrl(path);
        if (data?.publicUrl) {
          uploaded.push(data.publicUrl);
          try {
            await upsertSkuImageIndex(skuId, data.publicUrl, file);
          } catch (indexError) {
            setError(indexError instanceof Error ? indexError.message : "สร้างดัชนีรูปภาพไม่สำเร็จ");
          }
        }
      }
    } finally {
      setUploadingImages(false);
    }
    return uploaded;
  }

  async function loadSkuImages(skuIds: string[]) {
    if (!supabase || skuIds.length === 0) return;
    const bucket = supabase.storage.from("tires");
    const entries = await Promise.all(
      skuIds.map(async (skuId) => {
        const { data } = await bucket.list(skuId, { limit: 50, sortBy: { column: "created_at", order: "desc" } });
        const urls =
          data?.map((file) => bucket.getPublicUrl(`${skuId}/${file.name}`).data.publicUrl).filter(Boolean) || [];
        return [skuId, urls] as const;
      })
    );
    const next: Record<string, string[]> = {};
    entries.forEach(([skuId, urls]) => {
      if (urls.length > 0) next[skuId] = urls;
    });
    setImageMap(next);
  }

  async function removeAllImages(skuId: string) {
    if (!supabase) return;
    const bucket = supabase.storage.from("tires");
    const { data } = await bucket.list(skuId, { limit: 200 });
    if (!data || data.length === 0) return;
    const paths = data.map((file) => `${skuId}/${file.name}`);
    await bucket.remove(paths);
  }

  async function upsertSkuImageIndex(
    skuId: string,
    imageUrl: string,
    file: File
  ) {
    if (!supabase) return;
    const formData = new FormData();
    formData.append("sku_id", skuId);
    formData.append("image_url", imageUrl);
    formData.append("source", "manual");
    formData.append("image", file);
    const response = await fetch("/api/products/index-image", {
      method: "POST",
      body: formData
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error || "อัปเดตดัชนีรูปภาพไม่สำเร็จ");
    }
  }

  function handleSelectSearchImage(file: File | null) {
    setImageSearchFile(file);
    setImageSearchResults([]);
    setImageSearchMessage(null);
    if (imageSearchPreview) URL.revokeObjectURL(imageSearchPreview);
    setImageSearchPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSearchByImage() {
    if (!imageSearchFile) {
      setImageSearchMessage("กรุณาเลือกรูปภาพก่อนค้นหา");
      return;
    }
    setImageSearchLoading(true);
    setImageSearchMessage(null);
    setImageSearchResults([]);
    try {
      const formData = new FormData();
      formData.append("image", imageSearchFile);
      const response = await fetch("/api/products/search-by-image", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        matches?: ImageSearchResult[];
      };
      if (!response.ok) {
        throw new Error(payload.error || "ค้นหาด้วยรูปไม่สำเร็จ");
      }
      setImageSearchResults(payload.matches ?? []);
      setImageSearchMessage(payload.message ?? null);
    } catch (err) {
      setImageSearchMessage(err instanceof Error ? err.message : "ค้นหาด้วยรูปไม่สำเร็จ");
    } finally {
      setImageSearchLoading(false);
    }
  }

  function openCarDetail(item: StockItem) {
    setDetailItem(item);
    setDetailOpen(true);
  }

  function parseSize(input: string) {
    const match = input.match(/(\d{3})\/(\d{2})\s*R?(\d{2})/i);
    if (!match) return { width: null, aspect: null, rim: null };
    return {
      width: Number(match[1]),
      aspect: Number(match[2]),
      rim: Number(match[3])
    };
  }

  async function parseExcel(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(worksheet, {
      header: 1,
      defval: ""
    });
    const normalized = rows
      .map((row) => row.map((cell) => String(cell ?? "").trim()))
      .filter((row) => row.some((cell) => cell.length > 0));
    setCsvRows(normalized);
  }

  function downloadExcelTemplate() {
    const rows = [
      [
        "site_code",
        "brand",
        "name",
        "sku_code",
        "size_label",
        "cost_price",
        "qty_on_hand",
        "min_stock",
        "car_make",
        "car_model",
        "car_year_from",
        "car_year_to"
      ],
      [
        "car_retail",
        "Michelin",
        "Primacy 4",
        "MIC-PRI4-19565R15",
        "195/65R15",
        "2200",
        "40",
        "8",
        "Toyota",
        "Corolla Altis",
        "2016",
        "2024"
      ],
      [
        "truck_dealer",
        "Bridgestone",
        "R-Steer 001",
        "BRS-RST-31580R22",
        "315/80R22",
        "8200",
        "12",
        "4",
        "Hino",
        "500 Series",
        "2018",
        "2026"
      ]
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "stock_import");
    XLSX.writeFile(wb, "stock-import-template.xlsx");
  }

  async function handleCsvImport() {
    if (!supabase) return;
    if (csvRows.length < 2) {
      setCsvError("ไม่พบข้อมูล Excel");
      return;
    }
    setCsvError(null);

    const header = csvRows[0].map((h) => h.toLowerCase());
    const rows = csvRows.slice(1);

    for (const row of rows) {
      const data: Record<string, string> = {};
      header.forEach((key, idx) => {
        data[key] = row[idx] || "";
      });

      const site = sites.find((s) => s.code === data.site_code) || sites[0];
      if (!site) continue;

      const productRes = await supabase.from("products").insert({
        site_id: site.id,
        brand: data.brand,
        name: data.name,
        car_make: data.car_make || null,
        car_model: data.car_model || null,
        car_year_from: data.car_year_from ? Number(data.car_year_from) : null,
        car_year_to: data.car_year_to ? Number(data.car_year_to) : null
      }).select("id").single();

      if (productRes.error) continue;

      const sizeParts = parseSize(data.size_label || "");
      const skuRes = await supabase.from("skus").insert({
        product_id: productRes.data.id,
        sku_code: data.sku_code,
        size_label: data.size_label || null,
        width_mm: sizeParts.width,
        aspect_ratio: sizeParts.aspect,
        rim_inch: sizeParts.rim,
        cost_price: Number(data.cost_price || 0)
      }).select("id").single();

      if (skuRes.error) continue;

      await supabase.from("inventory").insert({
        sku_id: skuRes.data.id,
        qty_on_hand: Number(data.qty_on_hand || 0),
        min_stock: Number(data.min_stock || 0)
      });
    }

    await loadItems();
  }

  return (
    <div className="page active">
      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        <select
          className="filter-select"
          value={filterSite}
          onChange={(e) => setFilterSite(e.target.value)}
        >
          <option value="all">ทุกประเภท</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>{site.name}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={filterBrand}
          onChange={(e) => setFilterBrand(e.target.value)}
        >
          <option value="all">ทุกแบรนด์</option>
          {brandOptions.map((brand) => (
            <option key={brand} value={brand}>{brand}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">ทุกสถานะ</option>
          <option value="ok">Stock ปกติ</option>
          <option value="low">Stock ต่ำ</option>
        </select>

        <div className="search-bar" style={{ width: 220 }}>
          <input
            placeholder="ค้นหาชื่อ/sku/size"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="filter-select"
            style={{ width: 90 }}
            placeholder="หน้ากว้าง"
            value={sizeWidth}
            onChange={(e) => setSizeWidth(e.target.value)}
          />
          <input
            className="filter-select"
            style={{ width: 90 }}
            placeholder="แก้มยาง"
            value={sizeAspect}
            onChange={(e) => setSizeAspect(e.target.value)}
          />
          <input
            className="filter-select"
            style={{ width: 90 }}
            placeholder="กระทะ"
            value={sizeRim}
            onChange={(e) => setSizeRim(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="filter-select"
            style={{ width: 120 }}
            placeholder="ยี่ห้อรถ"
            value={carMake}
            onChange={(e) => setCarMake(e.target.value)}
          />
          <input
            className="filter-select"
            style={{ width: 120 }}
            placeholder="รุ่นรถ"
            value={carModel}
            onChange={(e) => setCarModel(e.target.value)}
          />
          <input
            className="filter-select"
            style={{ width: 100 }}
            placeholder="ปี"
            value={carYear}
            onChange={(e) => setCarYear(e.target.value)}
          />
        </div>

        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={downloadExcelTemplate}>
          ดาวน์โหลด Template Excel
        </button>
        <label className="btn btn-ghost" style={{ cursor: "pointer" }}>
          นำเข้า Excel
          <input
            type="file"
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await parseExcel(file);
            }}
          />
        </label>
        {/*      <button className="btn btn-ghost" onClick={() => setImageSearchOpen(true)}>
          ค้นหาด้วยรูป
        </button> */}
        <button className="btn btn-primary" onClick={openCreate}>
          เพิ่มสินค้า
        </button>
      </div>

      {csvRows.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-head">
            <span className="card-title">Excel Preview</span>
            <button className="btn btn-primary" onClick={handleCsvImport}>นำเข้า</button>
          </div>
          <div className="card-body">
            {csvError && <div style={{ color: "var(--red)", marginBottom: 8 }}>{csvError}</div>}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {csvRows[0].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvRows.slice(1, 6).map((row, idx) => (
                    <tr key={idx}>
                      {row.map((cell, cidx) => (
                        <td key={cidx}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--text3)" }}>
              ตัวอย่างหัวคอลัมน์: site_code, brand, name, sku_code, size_label, cost_price, qty_on_hand, min_stock, car_make, car_model, car_year_from, car_year_to
            </div>
          </div>
        </div>
      )}

      <ActionFeedback error={error} onClearError={() => setError(null)} />
      <ActionFeedback
        success={saveSuccess}
        error={saveError}
        onClearSuccess={() => setSaveSuccess(null)}
        onClearError={() => setSaveError(null)}
      />

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <span className="card-title">Audit: ประวัติเบิกฟรี/ของแถม</span>
          <button className="btn btn-ghost" onClick={loadMovementAudits}>
            รีเฟรชประวัติ
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>เวลา</th>
                <th>ประเภท</th>
                <th>สินค้า</th>
                <th>จำนวน</th>
                <th>อ้างอิง</th>
                <th>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {movementAudits.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: "var(--text3)" }}>
                    ยังไม่มีประวัติการเบิกฟรี/ของแถม
                  </td>
                </tr>
              ) : (
                movementPagination.paginatedRows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ fontSize: 12, color: "var(--text2)" }}>
                      {new Date(row.created_at).toLocaleString("th-TH")}
                    </td>
                    <td>
                      <span className="badge process">
                        {row.movement_type === "bonus" ? "ของแถม" : "เบิกฟรีหน้างาน"}
                      </span>
                    </td>
                    <td>
                      {(row.skus?.products?.brand ?? "")} {(row.skus?.products?.name ?? "")} {row.skus?.size_label ?? ""} ({row.skus?.sku_code ?? "-"})
                    </td>
                    <td className="mono" style={{ color: "var(--red)" }}>
                      {row.qty_change}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text2)" }}>
                      {row.ref_type ?? "-"} {row.ref_id ? `(${row.ref_id.slice(0, 8)})` : ""}
                    </td>
                    <td>{row.note ?? "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePaginationControls
          page={movementPagination.page}
          totalPages={movementPagination.totalPages}
          pageSize={movementPagination.pageSize}
          totalItems={movementPagination.totalItems}
          onPageChange={movementPagination.setPage}
          onPageSizeChange={movementPagination.setPageSize}
        />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>สินค้า</th>
                <th>SKU</th>
                <th>Size</th>
                <th>รูปภาพ</th>
                <th>Site</th>
                <th>Stock</th>
                <th>Min</th>
                <th>Cost</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ color: "var(--text3)" }}>กำลังโหลดข้อมูล...</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ color: "var(--text3)" }}>ไม่พบสินค้า</td>
                </tr>
              ) : (
                itemsPagination.paginatedRows.map((item) => (
                  <Fragment key={item.sku_id}>
                    <tr>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.brand}</div>
                        <div style={{ fontSize: 12, color: "var(--text2)" }}>{item.name}</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                          {item.is_hot ? <span className="badge paid">ขายดี</span> : null}
                          {Object.keys(item.group_old_prices).length > 0 ? <span className="badge pending">ลดราคา</span> : null}
                          {Object.keys(item.group_promo_prices).length > 0 ? <span className="badge paid">ราคาโปร</span> : null}
                          {item.is_promotion ? <span className="badge process">โปรเด็ด</span> : null}
                          {item.is_new ? <span className="badge process">สินค้าใหม่</span> : null}
                          {item.qty_on_hand <= item.min_stock ? <span className="badge cancel">ใกล้หมด</span> : null}
                        </div>
                        {item.car_brands.length > 0 && (
                          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
                            รถ: {item.car_brands.map((b) => b.name).join(", ")}
                          </div>
                        )}
                        {item.car_models.length > 0 && (
                          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                            รุ่น: {item.car_models.map((m) => m.name).join(", ")}
                          </div>
                        )}
                      </td>
                      <td className="mono" style={{ color: "var(--text2)" }}>{item.sku_code}</td>
                      <td className="mono">{item.size_label || sizePlaceholder}</td>
                      <td>
                        {imageMap[item.sku_id]?.[0] ? (
                          <img
                            src={imageMap[item.sku_id][0]}
                            alt={item.name}
                            className="image-thumb-row"
                          />
                        ) : (
                          <span style={{ color: "var(--text3)", fontSize: 12 }}>ไม่มีรูป</span>
                        )}
                        {imageMap[item.sku_id]?.length ? (
                          <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 4 }}>
                            {imageMap[item.sku_id].length} รูป
                          </div>
                        ) : null}
                      </td>
                      <td>{item.site_name}</td>
                      <td>
                        <span className={item.qty_on_hand <= item.min_stock ? "badge pending" : "badge paid"}>
                          {item.qty_on_hand}
                        </span>
                      </td>
                      <td>{item.min_stock}</td>
                      <td className="mono">฿{item.cost_price.toFixed(0)}</td>
                      <td style={{ gap: 6 }}>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "4px 10px", fontSize: 12 }}
                          onClick={() => openCarDetail(item)}
                        >
                          รุ่นรถ
                        </button>
                        <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => adjustStock(item, 5)}>+5</button>
                        <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => adjustStock(item, -5)}>-5</button>
                        <button className="btn btn-primary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => void openEdit(item)}>แก้ไข</button>
                        <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => handleDelete(item)}>ลบ</button>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={9} style={{ background: "var(--bg2)", borderTop: "none", paddingTop: 6, paddingBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                          <span style={{ fontSize: 11, color: "var(--text3)", minWidth: 70 }}>ราคาขาย</span>
                          {customerGroups.map((group) => {
                            const price = item.group_prices[group.id];
                            return (
                              <span
                                key={`${item.sku_id}-${group.id}-chip`}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  border: "1px solid var(--border)",
                                  borderRadius: 999,
                                  background: "var(--bg)",
                                  padding: "4px 10px",
                                  fontSize: 11
                                }}
                              >
                                <span style={{ color: "var(--text3)" }}>{group.name}</span>
                                <span className="mono" style={{ color: "var(--text2)", fontWeight: 600 }}>
                                  {typeof price === "number" ? `฿${price.toLocaleString("th-TH")}` : "-"}
                                </span>
                                {typeof item.group_old_prices[group.id] === "number" ? (
                                  <span
                                    className="mono"
                                    style={{ color: "var(--text3)", textDecoration: "line-through" }}
                                  >
                                    ฿{item.group_old_prices[group.id].toLocaleString("th-TH")}
                                  </span>
                                ) : null}
                                {typeof item.group_promo_prices[group.id] === "number" ? (
                                  <span className="mono" style={{ color: "var(--red)", fontWeight: 600 }}>
                                    โปร ฿{item.group_promo_prices[group.id].toLocaleString("th-TH")}
                                  </span>
                                ) : null}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePaginationControls
          page={itemsPagination.page}
          totalPages={itemsPagination.totalPages}
          pageSize={itemsPagination.pageSize}
          totalItems={itemsPagination.totalItems}
          onPageChange={itemsPagination.setPage}
          onPageSizeChange={itemsPagination.setPageSize}
        />
      </div>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-head">
              <div className="modal-title">{form.sku_id ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</div>
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                ปิด
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-grid">
                {/*  <div>
                  <label className="auth-label ">Site</label>
                  <select
                    className="filter-select"
                    value={form.site_id}
                    onChange={(e) => {
                      clearFieldError("site_id");
                      setForm({ ...form, site_id: e.target.value });
                    }}
                  >
                    <option value="">เลือก Site</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>{site.name}</option>
                    ))}
                  </select>
                  {formErrors.site_id && (
                    <div style={{ color: "var(--red)", fontSize: 12, marginTop: 4 }}>
                      {formErrors.site_id}
                    </div>
                  )}
                </div> */}
                <div>
                  <label className="auth-label">ยี่ห้อ</label>
                  <select
                    className="filter-select"
                    value={form.brand_id}
                    onChange={(e) => {
                      clearFieldError("brand_id");
                      clearFieldError("model_id");
                      setForm({ ...form, brand_id: e.target.value, model_id: "" });
                    }}
                  >
                    <option value="">เลือกยี่ห้อ</option>
                    {tireBrands.map((brand) => (
                      <option key={brand.id} value={brand.id}>{brand.name}</option>
                    ))}
                  </select>
                  {formErrors.brand_id && (
                    <div style={{ color: "var(--red)", fontSize: 12, marginTop: 4 }}>
                      {formErrors.brand_id}
                    </div>
                  )}
                </div>
                <div>
                  <label className="auth-label">รุ่นยาง</label>
                  <select
                    className="filter-select"
                    value={form.model_id}
                    onChange={(e) => {
                      clearFieldError("model_id");
                      setForm({ ...form, model_id: e.target.value });
                    }}
                    disabled={!form.brand_id}
                  >
                    <option value="">เลือกรุ่น</option>
                    {tireModels
                      .filter((m) => m.brand_id === form.brand_id)
                      .map((model) => (
                        <option key={model.id} value={model.id}>{model.name}</option>
                      ))}
                  </select>
                  {formErrors.model_id && (
                    <div style={{ color: "var(--red)", fontSize: 12, marginTop: 4 }}>
                      {formErrors.model_id}
                    </div>
                  )}
                </div>

                <div>
                  <label className="auth-label">SKU</label>
                  <input
                    className="auth-input"
                    value={form.sku_code}
                    onChange={(e) => {
                      clearFieldError("sku_code");
                      setForm({ ...form, sku_code: e.target.value });
                    }}
                  />
                  {formErrors.sku_code && (
                    <div style={{ color: "var(--red)", fontSize: 12, marginTop: 4 }}>
                      {formErrors.sku_code}
                    </div>
                  )}
                </div>
                <div>
                  <label className="auth-label">ขนาดยาง</label>
                  <input
                    className="auth-input"
                    value={form.size_label}
                    onChange={(e) => {
                      clearFieldError("size_label");
                      setForm({ ...form, size_label: e.target.value });
                    }}
                    placeholder={sizePlaceholder}
                  />
                  {formErrors.size_label && (
                    <div style={{ color: "var(--red)", fontSize: 12, marginTop: 4 }}>
                      {formErrors.size_label}
                    </div>
                  )}
                </div>
                <div>
                  <label className="auth-label">หน้ากว้าง (mm)</label>
                  <input
                    className="auth-input"
                    value={form.width_mm}
                    onChange={(e) => setForm({ ...form, width_mm: e.target.value })}
                    placeholder="เช่น 265"
                  />
                </div>
                <div>
                  <label className="auth-label">แก้มยาง</label>
                  <input
                    className="auth-input"
                    value={form.aspect_ratio}
                    onChange={(e) => setForm({ ...form, aspect_ratio: e.target.value })}
                    placeholder="เช่น 75"
                  />
                </div>
                <div>
                  <label className="auth-label">กระทะ (นิ้ว)</label>
                  <input
                    className="auth-input"
                    value={form.rim_inch}
                    onChange={(e) => setForm({ ...form, rim_inch: e.target.value })}
                    placeholder="เช่น 16"
                  />
                </div>
                <div>
                  <label className="auth-label">จัดการสินค้า</label>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
                    <label className="multi-select-item">
                      <input
                        type="checkbox"
                        checked={form.is_hot}
                        onChange={(e) => setForm({ ...form, is_hot: e.target.checked })}
                      />
                      <span>ขายดี</span>
                    </label>
                    <label className="multi-select-item">
                      <input
                        type="checkbox"
                        checked={form.is_promotion}
                        onChange={(e) => setForm({ ...form, is_promotion: e.target.checked })}
                      />
                      <span>โปรเด็ด</span>
                    </label>
                    <label className="multi-select-item">
                      <input
                        type="checkbox"
                        checked={form.is_new}
                        onChange={(e) => setForm({ ...form, is_new: e.target.checked })}
                      />
                      <span>สินค้าใหม่</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="auth-label">ยอดขายสะสม</label>
                  <input
                    className="auth-input"
                    value={form.total_sold}
                    onChange={(e) => setForm({ ...form, total_sold: e.target.value })}
                    placeholder="เช่น 120"
                  />
                </div>
                <div>
                  <label className="auth-label">ยี่ห้อรถ</label>
                  <div className="multi-select">
                    {carBrands.map((brand) => (
                      <label key={brand.id} className="multi-select-item">
                        <input
                          type="checkbox"
                          checked={form.car_brand_filter_ids.includes(brand.id)}
                          onChange={(e) => {
                            const nextBrandIds = e.target.checked
                              ? [...form.car_brand_filter_ids, brand.id]
                              : form.car_brand_filter_ids.filter((id) => id !== brand.id);
                            setForm({ ...form, car_brand_filter_ids: nextBrandIds, car_model_ids: [] });
                          }}
                        />
                        <span>{brand.name}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{ color: "var(--text3)", fontSize: 12, marginTop: 4 }}>
                    เลือกได้หลายยี่ห้อ
                  </div>
                </div>
                <div>
                  <label className="auth-label">รุ่นรถ (เลือกได้หลายรุ่น)</label>
                  <div className="multi-select">
                    {(() => {
                      const visibleModels = carModels.filter((m) =>
                        form.car_brand_filter_ids.length > 0
                          ? form.car_brand_filter_ids.includes(m.brand_id)
                          : true
                      );
                      const groupedByBrand = visibleModels.reduce<Record<string, CarModel[]>>((acc, model) => {
                        const key = model.brand_id;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(model);
                        return acc;
                      }, {});
                      return Object.entries(groupedByBrand).map(([brandId, models]) => {
                        const brandName = carBrands.find((brand) => brand.id === brandId)?.name ?? "ไม่ระบุยี่ห้อ";
                        return (
                          <Fragment key={brandId}>
                            <div
                              style={{
                                gridColumn: "1 / -1",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--text2)",
                                marginTop: 4,
                                paddingBottom: 6,
                                borderTop: "1px solid var(--border)",
                              }}
                            >
                              {brandName}
                            </div>
                            {models.map((model) => (
                              <label key={model.id} className="multi-select-item">
                                <input
                                  type="checkbox"
                                  checked={form.car_model_ids.includes(model.id)}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? [...form.car_model_ids, model.id]
                                      : form.car_model_ids.filter((id) => id !== model.id);
                                    setForm({ ...form, car_model_ids: next });
                                  }}
                                />
                                <span>{model.name}</span>
                              </label>
                            ))}
                          </Fragment>
                        );
                      });
                    })()}
                  </div>
                </div>
                <div>
                  <label className="auth-label">รุ่นที่เลือก</label>
                  <div className="selected-tags">
                    {form.car_model_ids.length === 0 ? (
                      <span style={{ color: "var(--text3)", fontSize: 12 }}>ยังไม่ได้เลือกรุ่น</span>
                    ) : (
                      form.car_model_ids.map((id) => {
                        const model = carModels.find((m) => m.id === id);
                        return (
                          <span key={id} className="tag">
                            {model?.name || id}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
                <div>
                  <label className="auth-label">รูปภาพสินค้า (ลากแล้ววางได้)</label>
                  <div
                    className="dropzone"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                  >
                    <div>ลากไฟล์มาวาง หรือคลิกเพื่อเลือก</div>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => onSelectImages(e.target.files)}
                    />
                    {uploadingImages && (
                      <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 6 }}>
                        กำลังอัปโหลด...
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="auth-label">ตัวอย่างรูปภาพ</label>
                  <div className="image-grid">
                    {form.images.length === 0 ? (
                      <span style={{ color: "var(--text3)", fontSize: 12 }}>ยังไม่มีรูป</span>
                    ) : (
                      form.images.map((src, idx) => (
                        <div key={`${src}-${idx}`} className="image-thumb-wrap">
                          <img src={src} alt={`preview-${idx}`} className="image-thumb" />
                          <button className="image-remove" onClick={() => removeImage(idx)}>ลบ</button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <label className="auth-label">ราคาทุน</label>
                  <input
                    className="auth-input"
                    value={form.cost_price}
                    onChange={(e) => {
                      clearFieldError("cost_price");
                      setForm({ ...form, cost_price: e.target.value });
                    }}
                  />
                  {formErrors.cost_price && (
                    <div style={{ color: "var(--red)", fontSize: 12, marginTop: 4 }}>
                      {formErrors.cost_price}
                    </div>
                  )}
                </div>
                {/*    <div>
                  <label className="auth-label">Stock</label>
                  <input
                    className="auth-input"
                    value={form.qty_on_hand}
                    onChange={(e) => {
                      clearFieldError("qty_on_hand");
                      setForm({ ...form, qty_on_hand: e.target.value });
                    }}
                  />
                  {formErrors.qty_on_hand && (
                    <div style={{ color: "var(--red)", fontSize: 12, marginTop: 4 }}>
                      {formErrors.qty_on_hand}
                    </div>
                  )}
                </div> */}
                <div>
                  <label className="auth-label">ขั้นต่ำ</label>
                  <input
                    className="auth-input"
                    value={form.min_stock}
                    onChange={(e) => {
                      clearFieldError("min_stock");
                      setForm({ ...form, min_stock: e.target.value });
                    }}
                  />
                  {formErrors.min_stock && (
                    <div style={{ color: "var(--red)", fontSize: 12, marginTop: 4 }}>
                      {formErrors.min_stock}
                    </div>
                  )}
                </div>

                <div>
                  <label className="auth-label">คำอธิบายสินค้า</label>
                  <textarea
                    className="auth-input"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="คำอธิบายสินค้า"
                  />
                </div>
                <div>
                  <label className="auth-label">รายละเอียดสินค้าเพิ่มเติม</label>
                  <textarea
                    className="auth-input"
                    rows={3}
                    value={form.remark}
                    onChange={(e) => setForm({ ...form, remark: e.target.value })}
                    placeholder="รายละเอียดสินค้าเพิ่มเติม"
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="auth-label">ราคาขายตามกลุ่มลูกค้า</label>
                  <div
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      background: "var(--bg2)",
                      padding: 12
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gap: 10,
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
                      }}
                    >
                      {customerGroups.map((group) => (
                        <div
                          key={group.id}
                          style={{
                            border: "1px solid var(--border)",
                            borderRadius: 10,
                            background: "var(--bg)",
                            padding: 10
                          }}
                        >
                          <label className="auth-label" style={{ display: "block", marginBottom: 6 }}>
                            {group.name}
                          </label>
                          <input
                            className="auth-input"
                            placeholder="ราคาขาย"
                            value={form.group_prices[group.id] ?? ""}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                group_prices: { ...prev.group_prices, [group.id]: e.target.value }
                              }))
                            }
                          />
                          <input
                            className="auth-input"
                            placeholder="ราคาเดิม (สำหรับลดราคา)"
                            style={{ marginTop: 6 }}
                            value={form.group_old_prices[group.id] ?? ""}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                group_old_prices: { ...prev.group_old_prices, [group.id]: e.target.value }
                              }))
                            }
                          />
                          <input
                            className="auth-input"
                            placeholder="ราคาโปรโมชั่น"
                            style={{ marginTop: 6 }}
                            value={form.group_promo_prices[group.id] ?? ""}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                group_promo_prices: { ...prev.group_promo_prices, [group.id]: e.target.value }
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              {modalError ? (
                <div style={{ color: "var(--red)", fontSize: 12, marginRight: "auto" }}>
                  {modalError}
                </div>
              ) : null}
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                ยกเลิก
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {imageSearchOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 760 }}>
            <div className="modal-head">
              <div className="modal-title">ค้นหาสินค้าด้วยรูปภาพ (Phase 1)</div>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setImageSearchOpen(false);
                  handleSelectSearchImage(null);
                }}
              >
                ปิด
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 10 }}>
                <label className="auth-label">อัปโหลดรูปเพื่อค้นหา</label>
                <div className="dropzone">
                  <div>ลากไฟล์มาวาง หรือคลิกเพื่อเลือก</div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleSelectSearchImage(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              {imageSearchPreview && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 6 }}>
                    รูปที่ใช้ค้นหา
                  </div>
                  <img
                    src={imageSearchPreview}
                    alt="search-preview"
                    style={{
                      width: "100%",
                      maxHeight: 260,
                      objectFit: "contain",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      background: "var(--bg3)"
                    }}
                  />
                </div>
              )}

              {imageSearchMessage && (
                <div style={{ marginBottom: 10, fontSize: 12, color: "var(--text2)" }}>
                  {imageSearchMessage}
                </div>
              )}

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>รูป</th>
                      <th>สินค้า</th>
                      <th>SKU</th>
                      <th>ขนาด</th>
                      <th style={{ width: 120 }}>คะแนน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imageSearchResults.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ color: "var(--text3)" }}>
                          ยังไม่มีผลลัพธ์
                        </td>
                      </tr>
                    ) : (
                      imageSearchResults.map((result, idx) => (
                        <tr key={`${result.sku_id}-${idx}`}>
                          <td>
                            {result.image_url ? (
                              <img
                                src={result.image_url}
                                alt={result.sku_code ?? result.sku_id}
                                className="image-thumb-row"
                              />
                            ) : (
                              "-"
                            )}
                          </td>
                          <td>{`${result.brand ?? ""} ${result.name ?? ""}`.trim() || "-"}</td>
                          <td className="mono">{result.sku_code ?? "-"}</td>
                          <td className="mono">{result.size_label ?? "-"}</td>
                          <td className="mono">{Math.round((result.score ?? 0) * 100)}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => handleSelectSearchImage(null)}>
                ล้างรูป
              </button>
              <button className="btn btn-primary" onClick={handleSearchByImage} disabled={imageSearchLoading}>
                {imageSearchLoading ? "กำลังค้นหา..." : "ค้นหา"}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailOpen && detailItem && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-head">
              <div className="modal-title">รุ่นรถที่ผูกกับ {detailItem.brand} {detailItem.name}</div>
              <button className="btn btn-ghost" onClick={() => setDetailOpen(false)}>
                ปิด
              </button>
            </div>
            <div className="modal-body">
              {detailItem.car_models.length === 0 ? (
                <div style={{ color: "var(--text3)" }}>ยังไม่ได้เลือกรุ่นรถ</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ยี่ห้อรถ</th>
                        <th>รุ่นรถ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailItem.car_models.map((m) => (
                        <tr key={m.id}>
                          <td>{Array.isArray(m.car_brands) ? m.car_brands[0]?.name || "-" : m.car_brands?.name || "-"}</td>
                          <td>{m.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setDetailOpen(false)}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
