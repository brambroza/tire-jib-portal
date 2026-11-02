"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ActionFeedback from "../ui/ActionFeedback";
import TablePaginationControls from "../ui/TablePaginationControls";
import { useTablePagination } from "../ui/useTablePagination";

type Brand = {
  id: string;
  name: string;
  country: string | null;
};

type Model = {
  id: string;
  brand_id: string;
  name: string;
  segment: string | null;
  tire_brands?: { name: string } | null;
};

type BrandForm = {
  id: string;
  name: string;
  country: string;
};

type ModelForm = {
  id: string;
  brand_id: string;
  name: string;
  segment: string;
};

type DuplicateDialogState = {
  open: boolean;
  title: string;
  message: string;
};

const emptyBrand: BrandForm = { id: "", name: "", country: "" };
const emptyModel: ModelForm = { id: "", brand_id: "", name: "", segment: "" };

export default function TireCatalogPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [searchBrand, setSearchBrand] = useState("");
  const [searchModel, setSearchModel] = useState("");
  const [brandModal, setBrandModal] = useState(false);
  const [modelModal, setModelModal] = useState(false);
  const [brandForm, setBrandForm] = useState<BrandForm>(emptyBrand);
  const [modelForm, setModelForm] = useState<ModelForm>(emptyModel);
  const [error, setError] = useState<string | null>(null);
  const [duplicateDialog, setDuplicateDialog] = useState<DuplicateDialogState>({
    open: false,
    title: "",
    message: ""
  });

  useEffect(() => {
    if (!supabase) {
      setError("กรุณาตั้งค่า NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY");
      return;
    }
    loadAll();
  }, []);

  async function loadAll() {
    if (!supabase) return;
    const [brandRes, modelRes] = await Promise.all([
      supabase.from("tire_brands").select("id,name,country").order("name"),
      supabase.from("tire_models").select("id,brand_id,name,segment,tire_brands(name)").order("name")
    ]);
    if (brandRes.data) setBrands(brandRes.data as Brand[]);
    if (modelRes.data) setModels(modelRes.data as unknown as Model[]);
  }

  const filteredBrands = useMemo(() => {
    if (!searchBrand) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(searchBrand.toLowerCase()));
  }, [brands, searchBrand]);

  const filteredModels = useMemo(() => {
    if (!searchModel) return models;
    return models.filter((m) =>
      [m.name, m.tire_brands?.name || ""].join(" ").toLowerCase().includes(searchModel.toLowerCase())
    );
  }, [models, searchModel]);

  const modelNameOptions = useMemo(() => {
    const seen = new Set<string>();
    const names = models
      .map((m) => m.name.trim())
      .filter((name) => name.length > 0)
      .filter((name) => {
        const key = name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    names.sort((a, b) => a.localeCompare(b, "th"));
    return names;
  }, [models]);
  const brandPagination = useTablePagination(filteredBrands, 10);
  const modelPagination = useTablePagination(filteredModels, 10);

  function openBrandModal(brand?: Brand) {
    if (brand) {
      setBrandForm({ id: brand.id, name: brand.name, country: brand.country || "" });
    } else {
      setBrandForm(emptyBrand);
    }
    setBrandModal(true);
  }

  function openModelModal(model?: Model) {
    if (model) {
      setModelForm({
        id: model.id,
        brand_id: model.brand_id,
        name: model.name,
        segment: model.segment || ""
      });
    } else {
      setModelForm({ ...emptyModel, brand_id: brands[0]?.id || "" });
    }
    setModelModal(true);
  }

  async function saveBrand() {
    if (!supabase) return;
    if (!brandForm.name) {
      setError("กรุณากรอกชื่อยี่ห้อ");
      return;
    }
    setError(null);
    if (brandForm.id) {
      await supabase.from("tire_brands").update({ name: brandForm.name, country: brandForm.country || null }).eq("id", brandForm.id);
    } else {
      await supabase.from("tire_brands").insert({ name: brandForm.name, country: brandForm.country || null });
    }
    setBrandModal(false);
    await loadAll();
  }

  async function saveModel() {
    if (!supabase) return;
    if (!modelForm.name || !modelForm.brand_id) {
      setError("กรุณากรอกยี่ห้อและรุ่น");
      return;
    }
    const normalizedName = modelForm.name.trim().toLowerCase();
    const duplicated = models.some(
      (m) =>
        m.brand_id === modelForm.brand_id &&
        m.name.trim().toLowerCase() === normalizedName &&
        m.id !== modelForm.id
    );
    if (duplicated) {
      const brandName = brands.find((b) => b.id === modelForm.brand_id)?.name ?? "-";
      setDuplicateDialog({
        open: true,
        title: "พบข้อมูลซ้ำ",
        message: `ลายยาง "${modelForm.name.trim()}" มีอยู่แล้วในยี่ห้อ "${brandName}" กรุณาเปลี่ยนชื่อหรือเลือกยี่ห้ออื่น`
      });
      return;
    }
    setError(null);
    if (modelForm.id) {
      await supabase.from("tire_models").update({
        brand_id: modelForm.brand_id,
        name: modelForm.name.trim(),
        segment: modelForm.segment || null
      }).eq("id", modelForm.id);
    } else {
      await supabase.from("tire_models").insert({
        brand_id: modelForm.brand_id,
        name: modelForm.name.trim(),
        segment: modelForm.segment || null
      });
    }
    setModelModal(false);
    await loadAll();
  }

  async function removeBrand(id: string) {
    if (!supabase) return;
    if (!confirm("ยืนยันการลบยี่ห้อ? รุ่นที่เกี่ยวข้องจะถูกลบด้วย")) return;
    await supabase.from("tire_brands").delete().eq("id", id);
    await loadAll();
  }

  async function removeModel(id: string) {
    if (!supabase) return;
    if (!confirm("ยืนยันการลบลายยาง?")) return;
    await supabase.from("tire_models").delete().eq("id", id);
    await loadAll();
  }

  return (
    <div className="page active">
      <div className="grid2" style={{ marginBottom: 14 }}>
        <div className="card">
          <div className="card-head">
            <span className="card-title">ยี่ห้อยาง</span>
            <button className="btn btn-primary" onClick={() => openBrandModal()}>เพิ่มยี่ห้อ</button>
          </div>
          <div className="card-body">
            <div className="search-bar" style={{ width: 220, marginBottom: 10 }}>
              <input
                placeholder="ค้นหายี่ห้อ"
                value={searchBrand}
                onChange={(e) => setSearchBrand(e.target.value)}
              />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ชื่อยี่ห้อ</th>
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
            <span className="card-title">ลายยาง</span>
            <button className="btn btn-primary" onClick={() => openModelModal()}>เพิ่มลายยาง</button>
          </div>
          <div className="card-body">
            <div className="search-bar" style={{ width: 220, marginBottom: 10 }}>
              <input
                placeholder="ค้นหาลายยาง"
                value={searchModel}
                onChange={(e) => setSearchModel(e.target.value)}
              />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ลายยาง</th>
                    <th>ยี่ห้อ</th>
                    <th>Segment</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {modelPagination.paginatedRows.map((model) => (
                    <tr key={model.id}>
                      <td>{model.name}</td>
                      <td style={{ color: "var(--text2)" }}>{model.tire_brands?.name || "-"}</td>
                      <td style={{ color: "var(--text2)" }}>{model.segment || "-"}</td>
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

      <ActionFeedback error={error} onClearError={() => setError(null)} />

      {brandModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-head">
              <div className="modal-title">{brandForm.id ? "แก้ไขยี่ห้อ" : "เพิ่มยี่ห้อ"}</div>
              <button className="btn btn-ghost" onClick={() => setBrandModal(false)}>ปิด</button>
            </div>
            <div className="modal-body">
              <div className="modal-grid">
                <div>
                  <label className="auth-label">ชื่อยี่ห้อ</label>
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
              <div className="modal-title">{modelForm.id ? "แก้ไขลายยาง" : "เพิ่มลายยาง"}</div>
              <button className="btn btn-ghost" onClick={() => setModelModal(false)}>ปิด</button>
            </div>
            <div className="modal-body">
              <div className="modal-grid">
                <div>
                  <label className="auth-label">ยี่ห้อ</label>
                  <select className="filter-select" value={modelForm.brand_id} onChange={(e) => setModelForm({ ...modelForm, brand_id: e.target.value })}>
                    <option value="">เลือกยี่ห้อ</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>{brand.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="auth-label">ลายยาง</label>
                  <input
                    className="auth-input"
                    list="tire-model-name-options"
                    placeholder="พิมพ์เพื่อค้นหาลายยาง"
                    value={modelForm.name}
                    onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })}
                  />
                  <datalist id="tire-model-name-options">
                    {modelNameOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="auth-label">Segment</label>
                  <input className="auth-input" value={modelForm.segment} onChange={(e) => setModelForm({ ...modelForm, segment: e.target.value })} />
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

      {duplicateDialog.open && (
        <div className="modal-overlay" role="alertdialog" aria-modal="true" aria-labelledby="duplicate-dialog-title">
          <div className="modal-card" style={{ maxWidth: 460 }}>
            <div className="modal-head">
              <div className="modal-title" id="duplicate-dialog-title">{duplicateDialog.title}</div>
            </div>
            <div className="modal-body">
              <div style={{ color: "var(--text2)", lineHeight: 1.6 }}>{duplicateDialog.message}</div>
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={() => setDuplicateDialog({ open: false, title: "", message: "" })}
                autoFocus
              >
                รับทราบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
