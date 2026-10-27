/* =====================================================================
   db.js — toda la conversación con Firebase vive aquí.
   - Un solo documento "inventario/actual" con el mapa { upc: cantidad }.
   - UN solo oyente (onSnapshot) por teléfono: ver existencias, buscar, cambiar de
     categoría, etc. se hace con lo que ya está en memoria → 0 lecturas.
   - Firebase solo manda datos cuando alguien escribe (vender, deshacer, Bodega).
   ===================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, collection, onSnapshot, runTransaction, setDoc, addDoc,
  query, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Caché local persistente: al reabrir la app se ve al instante y solo se bajan los cambios.
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
const invRef = doc(db, "inventario", "actual");
const ventasCol = collection(db, "ventas");

export const estado = { stock: {}, fecha: "", listo: false, enLinea: navigator.onLine, uid: null };
const oyentes = new Set();
export function suscribir(fn) { oyentes.add(fn); fn(estado); return () => oyentes.delete(fn); }
const avisa = () => oyentes.forEach(f => f(estado));

/* Arranque: acceso anónimo (sin contraseña) y UN oyente del inventario. */
let arrancado = false;
export async function iniciar() {
  if (arrancado) return; arrancado = true;
  await new Promise((ok, fail) => {
    onAuthStateChanged(auth, u => { if (u) { estado.uid = u.uid; ok(); } });
    signInAnonymously(auth).catch(fail);
  });
  onSnapshot(invRef, snap => {
    const d = snap.exists() ? snap.data() : {};
    estado.stock = d.stock || {};
    estado.fecha = d.fecha || "";
    estado.listo = true;
    avisa();
  }, err => { console.error(err); estado.error = err.message; avisa(); });
  window.addEventListener("online", () => { estado.enLinea = true; avisa(); });
  window.addEventListener("offline", () => { estado.enLinea = false; avisa(); });
}

/* Vender: resta 1 con transacción (si dos venden a la vez, nunca baja de 0) y anota la venta. */
export async function vender(upc) {
  const ok = await runTransaction(db, async tx => {
    const s = await tx.get(invRef);
    const q = ((s.data() || {}).stock || {})[upc] || 0;
    if (q <= 0) return false;
    tx.update(invRef, { ["stock." + upc]: q - 1 });
    return true;
  });
  if (ok) await addDoc(ventasCol, { upc, ts: Date.now(), por: estado.uid, deshecha: false, creada: serverTimestamp() });
  return ok;
}
/* Deshacer una venta (aunque haya pasado tiempo): suma 1 y marca la venta como deshecha. */
export async function deshacer(ventaId, upc) {
  const vRef = doc(db, "ventas", ventaId);
  return runTransaction(db, async tx => {
    const v = await tx.get(vRef);
    if (!v.exists() || v.data().deshecha) return false;
    const s = await tx.get(invRef);
    const q = ((s.data() || {}).stock || {})[upc] || 0;
    tx.update(invRef, { ["stock." + upc]: q + 1 });
    tx.update(vRef, { deshecha: true });
    return true;
  });
}
/* Bodega: reemplaza el inventario completo (1 escritura) → baja a todos los teléfonos. */
export async function publicarInventario(stock, fecha) {
  await setDoc(invRef, { stock, fecha: fecha || "", actualizadoPor: estado.uid, ts: Date.now() });
}
/* Últimas ventas (se escucha solo mientras la hoja "Ventas" está abierta). */
export function escucharVentas(fn) {
  return onSnapshot(query(ventasCol, orderBy("ts", "desc"), limit(40)), s => fn(s.docs.map(d => ({ id: d.id, ...d.data() }))));
}
