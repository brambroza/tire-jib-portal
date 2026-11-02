"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ActionFeedback from "../ui/ActionFeedback";
import TablePaginationControls from "../ui/TablePaginationControls";
import { useTablePagination } from "../ui/useTablePagination";

type CarBrand = { id: string; name: string; country: string | null };

type CarModel = {
  id: string;
  brand_id: string;
  name: string;
  car_brands?: { name: string } | { name: string }[] | null;
};

type CarYear = {
  id: string;
  model_id: string;
  year_from: number;
  year_to: number;
  car_models?: { name: string; car_brands?: { name: string } | { name: string }[] } | { name: string; car_brands?: { name: string } | { name: string }[] }[] | null;
};

type BrandForm = { id: string; name: string; country: string };

type ModelForm = { id: string; brand_id: string; name: string };

type YearForm = { id: string; model_id: string; year_from: string; year_to: string };

const emptyBrand: BrandForm = { id: "", name: "", country: "" };
const emptyModel: ModelForm = { id: "", brand_id: "", name: "" };
const emptyYear: YearForm = { id: "", model_id: "", year_from: "", year_to: "" };

export default function CarCatalogPage() {
  const [brands, setBrands] = useState<CarBrand[]>([]);
  const [models, setModels] = useState<CarModel[]>([]);
  const [years, setYears] = useState<CarYear[]>([]);
  const [searchBrand, setSearchBrand] = useState("");
  const [searchModel, setSearchModel] = useState("");
  const [searchYear, setSearchYear] = useState("");
  const [brandModal, setBrandModal] = useState(false);
  const [modelModal, setModelModal] = useState(false);
  const [yearModal, setYearModal] = useState(false);
  const [brandForm, setBrandForm] = useState<BrandForm>(emptyBrand);
  const [modelForm, setModelForm] = useState<ModelForm>(emptyModel);
  const [yearForm, setYearForm] = useState<YearForm>(emptyYear);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setError("กรุณาตั้งค่า NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY");
      return;
    }
    loadAll();
  }, []);

  async function loadAll() {
    if (!supabase) return;
    const [brandRes, modelRes, yearRes] = await Promise.all([
      supabase.from("car_brands").select("id,name,country").order("name"),
      supabase.from("car_models").select("id,brand_id,name,car_brands(name)").order("name"),
      supabase.from("car_years").select("id,model_id,year_from,year_to,car_models(name,car_brands(name))").order("year_from")
    ]);
    if (brandRes.data) setBrands(brandRes.data as CarBrand[]);
    if (modelRes.data) setModels(modelRes.data as CarModel[]);
    if (yearRes.data) setYears(yearRes.data as CarYear[]);
  }

  const filteredBrands = useMemo(() => {
    if (!searchBrand) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(searchBrand.toLowerCase()));
  }, [brands, searchBrand]);

  const filteredModels = useMemo(() => {
    if (!searchModel) return models;
    return models.filter((m) =>
      [
        m.name,
        Array.isArray(m.car_brands) ? m.car_brands[0]?.name || "" : m.car_brands?.name || ""
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchModel.toLowerCase())
    );
  }, [models, searchModel]);

  const filteredYears = useMemo(() => {
    if (!searchYear) return years;
    return years.filter((y) =>
      [
        Array.isArray(y.car_models)
          ? (Array.isArray(y.car_models[0]?.car_brands)
            ? y.car_models[0]?.car_brands?.[0]?.name || ""
            : y.car_models[0]?.car_brands?.name || "")
          : (Array.isArray(y.car_models?.car_brands)
            ? y.car_models?.car_brands?.[0]?.name || ""
            : y.car_models?.car_brands?.name || ""),
        Array.isArray(y.car_models) ? y.car_models[0]?.name || "" : y.car_models?.name || "",
        String(y.year_from),
        String(y.year_to)
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchYear.toLowerCase())
    );
  }, [years, searchYear]);
  const brandPagination = useTablePagination(filteredBrands, 10);
  const modelPagination = useTablePagination(filteredModels, 10);
  const yearPagination = useTablePagination(filteredYears, 10);

  function openBrandModal(brand?: CarBrand) {
    if (brand) {
      setBrandForm({ id: brand.id, name: brand.name, country: brand.country || "" });
    } else {
      setBrandForm(emptyBrand);
    }
    setBrandModal(true);
  }

  function openModelModal(model?: CarModel) {
    if (model) {
      setModelForm({ id: model.id, brand_id: model.brand_id, name: model.name });
    } else {
      setModelForm({ ...emptyModel, brand_id: brands[0]?.id || "" });
    }
    setModelModal(true);
  }

  function openYearModal(year?: CarYear) {
    if (year) {
      setYearForm({
        id: year.id,
        model_id: year.model_id,
        year_from: String(year.year_from),
        year_to: String(year.year_to)
      });
    } else {
      setYearForm({ ...emptyYear, model_id: models[0]?.id || "" });
    }
    setYearModal(true);
  }

  async function saveBrand() {
    if (!supabase) return;
    if (!brandForm.name) {
      setError("กรุณากรอกชื่อยี่ห้อรถ");
      return;
    }
    setError(null);
    if (brandForm.id) {
      await supabase.from("car_brands").update({ name: brandForm.name, country: brandForm.country || null }).eq("id", brandForm.id);
    } else {
      await supabase.from("car_brands").insert({ name: brandForm.name, country: brandForm.country || null });
    }
    setBrandModal(false);
    await loadAll();
  }

  async function saveModel() {
    if (!supabase) return;
    if (!modelForm.name || !modelForm.brand_id) {
      setError("กรุณาเลือกยี่ห้อและกรอกรุ่นรถ");
      return;
    }
    setError(null);
    if (modelForm.id) {
      await supabase.from("car_models").update({ brand_id: modelForm.brand_id, name: modelForm.name }).eq("id", modelForm.id);
    } else {
      await supabase.from("car_models").insert({ brand_id: modelForm.brand_id, name: modelForm.name });
    }
    setModelModal(false);
    await loadAll();
  }

  async function saveYear() {
    if (!supabase) return;
    if (!yearForm.model_id || !yearForm.year_from || !yearForm.year_to) {
      setError("กรุณาระบุรุ่นรถและช่วงปี");
      return;
    }
    setError(null);
    if (yearForm.id) {
      await supabase.from("car_years").update({
        model_id: yearForm.model_id,
        year_from: Number(yearForm.year_from),
        year_to: Number(yearForm.year_to)
      }).eq("id", yearForm.id);
    } else {
      await supabase.from("car_years").insert({
        model_id: yearForm.model_id,
        year_from: Number(yearForm.year_from),
        year_to: Number(yearForm.year_to)
      });
    }
    setYearModal(false);
    await loadAll();
  }

  async function removeBrand(id: string) {
    if (!supabase) return;
    if (!confirm("ยืนยันการลบยี่ห้อรถ? รุ่น/ปีที่เกี่ยวข้องจะถูกลบด้วย")) return;
    await supabase.from("car_brands").delete().eq("id", id);
    await loadAll();
  }

  async function removeModel(id: string) {
    if (!supabase) return;
    if (!confirm("ยืนยันการลบรุ่นรถ? ปีที่เกี่ยวข้องจะถูกลบด้วย")) return;
    await supabase.from("car_models").delete().eq("id", id);
    await loadAll();
  }

  async function removeYear(id: string) {
    if (!supabase) return;
    if (!confirm("ยืนยันการลบช่วงปีรถ?")) return;
    await supabase.from("car_years").delete().eq("id", id);
    await loadAll();
  }

  return (
    <div className="page active">
      <div className="grid2" style={{ marginBottom: 14 }}>
        <div className="card">
          <div className="card-head">
            <span className="card-title">ยี่ห้อรถ</span>
            <button className="btn btn-primary" onClick={() => openBrandModal()}>เพิ่มยี่ห้อรถ</button>
          </div>
          <div className="card-body">
            <div className="search-bar" style={{ width: 220, marginBottom: 10 }}>
              <input placeholder="ค้นหายี่ห้อรถ" value={searchBrand} onChange={(e) => setSearchBrand(e.target.value)} />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ยี่ห้อรถ</th>
                    <th>ประเทศ</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {brandPagination.paginatedRows.map((brand) => (
                    <tr key={brand.id}>
                      <td>{brand.name}</td>
                      <td style={{ color: "var(--text2)" }}>{brand.country || "-"}</td>
                      <td style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => openBrandModal(brand)}>แก้ไข</button>
                        <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => removeBrand(brand.id)}>ลบ</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePaginationControls
              page={brandPagination.page}
              totalPages={brandPagination.totalPages}
              pageSize={brandPagination.pageSize}
              totalItems={brandPagination.totalItems}
              onPageChange={brandPagination.setPage}
              onPageSizeChange={brandPagination.setPageSize}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="card-title">รุ่นรถ</span>
            <button className="btn btn-primary" onClick={() => openModelModal()}>เพิ่มรุ่นรถ</button>
          </div>
          <div className="card-body">
            <div className="search-bar" style={{ width: 220, marginBottom: 10 }}>
              <input placeholder="ค้นหารุ่นรถ" value={searchModel} onChange={(e) => setSearchModel(e.target.value)} />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>รุ่นรถ</th>
                    <th>ยี่ห้อรถ</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {modelPagination.paginatedRows.map((model) => (
                    <tr key={model.id}>
                      <td>{model.name}</td>
                      <td style={{ color: "var(--text2)" }}>
                        {Array.isArray(model.car_brands)
                          ? model.car_brands[0]?.name || "-"
                          : model.car_brands?.name || "-"}
                      </td>
                      <td style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => openModelModal(model)}>แก้ไข</button>
                        <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => removeModel(model.id)}>ลบ</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePaginationControls
              page={modelPagination.page}
              totalPages={modelPagination.totalPages}
              pageSize={modelPagination.pageSize}
              totalItems={modelPagination.totalItems}
              onPageChange={modelPagination.setPage}
              onPageSizeChange={modelPagination.setPageSize}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">ปีรถ</span>
          <button className="btn btn-primary" onClick={() => openYearModal()}>เพิ่มปีรถ</button>
        </div>
        <div className="card-body">
          <div className="search-bar" style={{ width: 220, marginBottom: 10 }}>
            <input placeholder="ค้นหาปีรถ" value={searchYear} onChange={(e) => setSearchYear(e.target.value)} />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ยี่ห้อรถ</th>
                  <th>รุ่นรถ</th>
                  <th>ปีรถ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {yearPagination.paginatedRows.map((year) => (
                  <tr key={year.id}>
                    <td>
                      {Array.isArray(year.car_models)
                        ? (Array.isArray(year.car_models[0]?.car_brands)
                          ? year.car_models[0]?.car_brands?.[0]?.name || "-"
                          : year.car_models[0]?.car_brands?.name || "-")
                        : (Array.isArray(year.car_models?.car_brands)
                          ? year.car_models?.car_brands?.[0]?.name || "-"
                          : year.car_models?.car_brands?.name || "-")}
                    </td>
                    <td>{Array.isArray(year.car_models) ? year.car_models[0]?.name || "-" : year.car_models?.name || "-"}</td>
                    <td style={{ color: "var(--text2)" }}>{year.year_from} - {year.year_to}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => openYearModal(year)}>แก้ไข</button>
                      <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => removeYear(year.id)}>ลบ</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePaginationControls
            page={yearPagination.page}
            totalPages={yearPagination.totalPages}
            pageSize={yearPagination.pageSize}
            totalItems={yearPagination.totalItems}
            onPageChange={yearPagination.setPage}
            onPageSizeChange={yearPagination.setPageSize}
          />
        </div>
      </div>

      <ActionFeedback error={error} onClearError={() => setError(null)} />

      {brandModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-head">
              <div className="modal-title">{brandForm.id ? "แก้ไขยี่ห้อรถ" : "เพิ่มยี่ห้อรถ"}</div>
              <button className="btn btn-ghost" onClick={() => setBrandModal(false)}>ปิด</button>
            </div>
            <div className="modal-body">
              <div className="modal-grid">
                <div>
                  <label className="auth-label">ยี่ห้อรถ</label>
                  <input className="auth-input" value={brandForm.name} onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })} />
                </div>
                <div>
                  <label className="auth-label">ประเทศ</label>
                  <input className="auth-input" value={brandForm.country} onChange={(e) => setBrandForm({ ...brandForm, country: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setBrandModal(false)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={saveBrand}>บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {modelModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-head">
              <div className="modal-title">{modelForm.id ? "แก้ไขรุ่นรถ" : "เพิ่มรุ่นรถ"}</div>
              <button className="btn btn-ghost" onClick={() => setModelModal(false)}>ปิด</button>
            </div>
            <div className="modal-body">
              <div className="modal-grid">
                <div>
                  <label className="auth-label">ยี่ห้อรถ</label>
                  <select className="filter-select" value={modelForm.brand_id} onChange={(e) => setModelForm({ ...modelForm, brand_id: e.target.value })}>
                    <option value="">เลือกยี่ห้อรถ</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>{brand.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="auth-label">รุ่นรถ</label>
                  <input className="auth-input" value={modelForm.name} onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModelModal(false)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={saveModel}>บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {yearModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-head">
              <div className="modal-title">{yearForm.id ? "แก้ไขปีรถ" : "เพิ่มปีรถ"}</div>
              <button className="btn btn-ghost" onClick={() => setYearModal(false)}>ปิด</button>
            </div>
            <div className="modal-body">
              <div className="modal-grid">
                <div>
                  <label className="auth-label">รุ่นรถ</label>
                  <select className="filter-select" value={yearForm.model_id} onChange={(e) => setYearForm({ ...yearForm, model_id: e.target.value })}>
                    <option value="">เลือกรุ่นรถ</option>
                    {models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="auth-label">ปีเริ่มต้น</label>
                  <input className="auth-input" value={yearForm.year_from} onChange={(e) => setYearForm({ ...yearForm, year_from: e.target.value })} />
                </div>
                <div>
                  <label className="auth-label">ปีสิ้นสุด</label>
                  <input className="auth-input" value={yearForm.year_to} onChange={(e) => setYearForm({ ...yearForm, year_to: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setYearModal(false)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={saveYear}>บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
