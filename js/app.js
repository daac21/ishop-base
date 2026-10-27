import { iniciar, suscribir, vender, deshacer, publicarInventario, escucharVentas, estado } from "./db.js";

const $ = s => document.querySelector(s);
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let texto = "";

function pinta() {
  const upcs = Object.keys(estado.stock).filter(u => estado.stock[u] > 0 && u.includes(texto)).sort();
  const total = Object.values(estado.stock).reduce((s, q) => s + q, 0);
  $("#estado").textContent = estado.error ? "Error: " + estado.error : !estado.listo ? "Conectando…" : estado.enLinea ? `En línea · ${total} pzas` : `Sin conexión · ${total} pzas (última copia)`;
  $("#lista").innerHTML = upcs.length ? upcs.map(u => `<div class="fila"><div><b>${esc(u)}</b></div><span class="q">${estado.stock[u]}</span><button data-v="${esc(u)}">Vendido</button></div>`).join("")
    : `<p class="vacio">${estado.listo ? "Sin existencias. Usa “Cargar datos de prueba”." : ""}</p>`;
}
suscribir(pinta);

$("#buscar").addEventListener("input", e => { texto = e.target.value.trim(); pinta(); });   // buscar = 0 lecturas
$("#lista").addEventListener("click", async e => {
  const u = e.target.dataset.v; if (!u) return;
  if (confirm("¿Vendiste este producto?\n" + u)) await vender(u);
});
$("#prueba").addEventListener("click", async () => {
  const demo = { "195950851687": 9, "195950852622": 7, "195950850741": 2, "195950488876": 8, "195950490282": 3 };
  if (confirm("Esto reemplaza TODO el inventario por datos de prueba. ¿Seguir?")) await publicarInventario(demo, new Date().toLocaleDateString("es-MX"));
});
$("#btnVentas").addEventListener("click", () => {
  const hoja = $("#hoja"); hoja.hidden = false;
  const stop = escucharVentas(vs => {
    $("#ventas").innerHTML = vs.map(v => `<div class="fila ${v.deshecha ? "hecha" : ""}"><div><b>${esc(v.upc)}</b><small>${new Date(v.ts).toLocaleString("es-MX")}${v.deshecha ? " · deshecha" : ""}</small></div>${v.deshecha ? "" : `<button data-id="${v.id}" data-u="${esc(v.upc)}">Deshacer</button>`}</div>`).join("") || `<p class="vacio">Sin ventas.</p>`;
  });
  $("#cerrar").onclick = () => { stop(); hoja.hidden = true; };
});
$("#ventas").addEventListener("click", async e => { const b = e.target.closest("button[data-id]"); if (b) await deshacer(b.dataset.id, b.dataset.u); });

iniciar().catch(err => { estado.error = err.message; pinta(); });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
