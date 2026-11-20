import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2/+esm';

const SUPABASE_URL = 'https://ubjcorwychblpbjxulwh.supabase.co';
const KEY = 'sb_publishable___I7onzSfTGUyjjHzqMIyw_cwVBIonA';
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const VISTAS = ['inicio', 'apps', 'clientes', 'venta', 'licencias'];
const SECCIONES = [
  { id: 'licencias', label: 'Licencias' }
  // Otra sección: agrega { id, label } y un <div data-panel="id"> en index.html.
];

const sb = createClient(SUPABASE_URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const $ = (sel, root = document) => root.querySelector(sel);
const penFmt = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

const state = {
  email: '',
  apps: [],
  clientes: [],
  ventas: [],
  licencias: [],
  renovaciones: [],
  editApp: null,
  editCliente: null
};
const filtros = { texto: '', estado: '', plazo: '' };
let vista = 'inicio';
let arranque = false;
let sesionAplicada = null;
let mostrandoCreada = false;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function isoHoy(d = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function sumarMeses(iso, meses) {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + meses;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const ultimo = new Date(ny, nm + 1, 0).getDate();
  const nd = Math.min(d, ultimo);
  const z = (n) => String(n).padStart(2, '0');
  return `${ny}-${z(nm + 1)}-${z(nd)}`;
}
function diasEntre(desde, hasta) {
  const utc = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(hasta) - utc(desde)) / 86400000);
}
function pen(n) { return penFmt.format(Number(n) || 0); }
function fechaCorta(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function textoDias(dias) {
  if (dias == null) return '—';
  if (dias < 0) return `Vencida hace ${-dias} ${-dias === 1 ? 'día' : 'días'}`;
  if (dias === 0) return 'Vence hoy';
  return `${dias} ${dias === 1 ? 'día' : 'días'}`;
}
function claseDias(dias) {
  if (dias == null || dias > 15) return '';
  return dias < 0 ? 'malo' : 'pronto';
}
function textoModalidad(m) { return m === 'venta_total' ? 'Venta total' : 'Licencia'; }
function textoEstado(e) {
  if (e === 'suspendida') return 'Suspendida';
  if (e === 'revocada') return 'Revocada';
  return 'Activa';
}
function textoTipo(t) { return t === 'web' ? 'Web' : t === 'otro' ? 'Otro' : 'APK'; }
function errorTexto(err) {
  const m = err?.message || 'No se pudo completar la operación.';
  const code = err?.code || '';
  if (/invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(m)) return 'Confirma el correo antes de entrar.';
  if (/already registered|already been registered/i.test(m)) return 'Esa cuenta ya existe. Entra con tu contraseña.';
  if (/password/i.test(m) && /at least|short|weak/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (code === '23503' || /foreign key/i.test(m)) return 'No se puede eliminar porque tiene ventas asociadas.';
  if (code === '23505' || /duplicate/i.test(m)) return 'Ese dato ya existe.';
  if (code === '42501' || /row-level security/i.test(m)) return 'Sin permiso para esta operación.';
  return m;
}
function claveLicencia() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let s = '';
  for (let i = 0; i < 16; i++) {
    s += ALFABETO[bytes[i] % ALFABETO.length];
    if (i === 3 || i === 7 || i === 11) s += '-';
  }
  return s;
}
async function copiar(texto, btn) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = texto;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  if (!btn) return;
  const prev = btn.textContent;
  btn.textContent = 'Copiado';
  setTimeout(() => { btn.textContent = prev; }, 1400);
}
function rangoMes(hoy = isoHoy()) {
  const [y, m] = hoy.split('-').map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  const z = (n) => String(n).padStart(2, '0');
  return { inicio: `${y}-${z(m)}-01`, fin: `${y}-${z(m)}-${z(ultimo)}` };
}
function mostrarAviso(el, texto, tipo) {
  if (!texto) { el.hidden = true; el.textContent = ''; el.classList.remove('info'); return; }
  el.hidden = false;
  el.textContent = texto;
  el.classList.toggle('info', tipo === 'info');
}
function appPorId() { return new Map(state.apps.map((a) => [a.id, a])); }
function clientePorId() { return new Map(state.clientes.map((c) => [c.id, c])); }
function ventaPorId() { return new Map(state.ventas.map((v) => [v.id, v])); }
function fichas() {
  const apps = appPorId();
  const clientes = clientePorId();
  const ventas = ventaPorId();
  const hoy = isoHoy();
  return state.licencias.map((lic) => {
    const v = ventas.get(lic.venta_id) || {};
    return {
      lic,
      v,
      app: apps.get(v.app_id),
      cli: clientes.get(v.cliente_id),
      dias: lic.fecha_vencimiento ? diasEntre(hoy, lic.fecha_vencimiento) : null
    };
  });
}

function pantalla(nombre) {
  $('#pantalla-carga').hidden = nombre !== 'carga';
  $('#pantalla-login').hidden = nombre !== 'login';
  $('#pantalla-creada').hidden = nombre !== 'creada';
  $('#pantalla-denegado').hidden = nombre !== 'denegado';
  $('#app').hidden = nombre !== 'app';
}
function mostrarLogin(msg) {
  mostrandoCreada = false;
  pantalla('login');
  mostrarAviso($('#login-msg'), msg || '');
}
function mostrarCreada(email) {
  mostrandoCreada = true;
  $('#creada-correo').textContent = email;
  pantalla('creada');
}
function mostrarDenegado(userId, extra) {
  pantalla('denegado');
  $('#denegado-id').textContent = userId || '';
  const extraEl = $('#denegado-extra');
  extraEl.hidden = !extra;
  extraEl.textContent = extra || '';
}

function mostrarVista(nombre) {
  vista = VISTAS.includes(nombre) ? nombre : 'inicio';
  for (const v of VISTAS) {
    $('#vista-' + v).hidden = v !== vista;
    const a = $(`#nav a[href="#${v}"]`);
    if (a) {
      if (v === vista) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
  }
  if (vista === 'inicio') renderInicio();
  else if (vista === 'apps') renderApps();
  else if (vista === 'clientes') renderClientes();
  else if (vista === 'venta') renderVenta();
  else renderLicencias(true);
}

async function entrar(session) {
  state.email = session.user?.email || '';
  const { data, error } = await sb.rpc('is_admin');
  if (error) {
    mostrarDenegado(session.user?.id, errorTexto(error));
    return;
  }
  if (data !== true) {
    mostrarDenegado(session.user?.id);
    return;
  }
  mostrandoCreada = false;
  $('#quien').textContent = state.email;
  pantalla('app');
  mostrarAviso($('#app-msg'), '');
  try {
    await cargar();
    const hash = location.hash.slice(1);
    mostrarVista(VISTAS.includes(hash) ? hash : 'inicio');
  } catch (err) {
    mostrarAviso($('#app-msg'), errorTexto(err));
  }
}

async function cargar() {
  const [apps, clientes, ventas, licencias, renovaciones] = await Promise.all([
    sb.from('apps').select('id, nombre, tipo, descripcion').order('nombre'),
    sb.from('clientes').select('id, nombre, documento, telefono, email, notas').order('nombre'),
    sb.from('ventas').select('id, app_id, cliente_id, modalidad, precio, moneda, fecha_venta, notas').order('fecha_venta', { ascending: false }),
    sb.from('licencias').select('id, venta_id, clave, fecha_inicio, fecha_vencimiento, estado, dispositivo, created_at').order('created_at', { ascending: false }),
    sb.from('renovaciones').select('id, licencia_id, vencimiento_anterior, vencimiento_nuevo, monto, fecha')
  ]);
  for (const r of [apps, clientes, ventas, licencias, renovaciones]) {
    if (r.error) throw r.error;
  }
  state.apps = apps.data || [];
  state.clientes = clientes.data || [];
  state.ventas = ventas.data || [];
  state.licencias = licencias.data || [];
  state.renovaciones = renovaciones.data || [];
}

async function recargar() {
  mostrarAviso($('#app-msg'), '');
  try {
    await cargar();
    mostrarVista(vista);
  } catch (err) {
    mostrarAviso($('#app-msg'), errorTexto(err));
  }
}

function resumen() {
  const { inicio, fin } = rangoMes();
  const ventas = ventaPorId();
  const apps = appPorId();
  const filas = new Map();
  const asegurar = (id) => {
    if (!filas.has(id)) filas.set(id, { nombre: apps.get(id)?.nombre || 'Sin app', mes: 0, total: 0 });
    return filas.get(id);
  };
  let mes = 0;
  let total = 0;
  const sumar = (id, monto, fecha) => {
    const n = Number(monto) || 0;
    const f = asegurar(id);
    f.total += n;
    total += n;
    if (fecha >= inicio && fecha <= fin) { f.mes += n; mes += n; }
  };
  for (const v of state.ventas) sumar(v.app_id, v.precio, v.fecha_venta);
  for (const r of state.renovaciones) {
    const lic = state.licencias.find((l) => l.id === r.licencia_id);
    const v = lic && ventas.get(lic.venta_id);
    if (v) sumar(v.app_id, r.monto, r.fecha);
  }
  const lista = [...filas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return { mes, total, lista, etiqueta: (() => {
    const s = new Date().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })() };
}

function renderInicio() {
  const r = resumen();
  const { pronto, vencidas } = alertas();
  const filas = r.lista.map((f) => `
    <tr>
      <td data-label="App">${esc(f.nombre)}</td>
      <td class="num" data-label="Este mes">${esc(pen(f.mes))}</td>
      <td class="num" data-label="Total">${esc(pen(f.total))}</td>
    </tr>`).join('');
  const bloque = (items, clase, titulo) => {
    if (!items.length) return '';
    return `<h2>${titulo}</h2>` + items.map((f) => `
      <article class="alerta ${clase}">
        <div>
          <b>${esc(f.cli?.nombre || 'Sin cliente')} · ${esc(f.app?.nombre || 'Sin app')}</b>
          <span>${esc(f.lic.clave)} · ${esc(textoDias(f.dias))} · vence ${esc(fechaCorta(f.lic.fecha_vencimiento))}</span>
        </div>
        <button type="button" class="secundario chico" data-ir="${esc(f.lic.clave)}">Ver</button>
      </article>`).join('');
  };
  const vacio = !pronto.length && !vencidas.length
    ? '<p class="vacio">No hay licencias por vencer ni vencidas.</p>' : '';
  $('#vista-inicio').innerHTML = `
    <h1>Inicio</h1>
    <p class="ayuda">Ventas del mes y licencias que vencen pronto.</p>
    <div class="metricas">
      <article class="metrica"><span>${esc(r.etiqueta)}</span><strong>${esc(pen(r.mes))}</strong></article>
      <article class="metrica"><span>Total vendido</span><strong>${esc(pen(r.total))}</strong></article>
    </div>
    <h2>Por app</h2>
    ${r.lista.length ? `<div class="tabla-wrap"><table class="resp">
      <thead><tr><th>App</th><th class="num">Este mes</th><th class="num">Total</th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr><td data-label="App"><b>Total</b></td><td class="num" data-label="Este mes"><b>${esc(pen(r.mes))}</b></td><td class="num" data-label="Total"><b>${esc(pen(r.total))}</b></td></tr></tfoot>
    </table></div>` : '<p class="vacio">Todavía no hay ventas ni renovaciones.</p>'}
    ${bloque(vencidas, 'rojo', 'Vencidas')}
    ${bloque(pronto, 'ambar', 'Vencen en 15 días o menos')}
    ${vacio}`;
  $('#vista-inicio').querySelectorAll('[data-ir]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filtros.texto = btn.getAttribute('data-ir');
      filtros.estado = '';
      filtros.plazo = '';
      if (location.hash !== '#licencias') location.hash = 'licencias';
      else mostrarVista('licencias');
    });
  });
}

function alertas() {
  const pronto = [];
  const vencidas = [];
  for (const f of fichas()) {
    if (f.lic.estado === 'revocada' || f.dias == null) continue;
    if (f.dias < 0) vencidas.push(f);
    else if (f.dias <= 15) pronto.push(f);
  }
  vencidas.sort((a, b) => a.dias - b.dias);
  pronto.sort((a, b) => a.dias - b.dias);
  return { pronto, vencidas };
}

function renderApps() {
  const edit = state.editApp;
  const filas = state.apps.map((a) => `
    <tr>
      <td data-label="Nombre">${esc(a.nombre)}</td>
      <td data-label="Tipo">${esc(textoTipo(a.tipo))}</td>
      <td data-label="Descripción">${esc(a.descripcion || '—')}</td>
      <td class="acciones" data-label="">
        <button type="button" class="secundario chico" data-editar="${esc(a.id)}">Editar</button>
        <button type="button" class="peligro chico" data-borrar="${esc(a.id)}">Eliminar</button>
      </td>
    </tr>`).join('');
  $('#vista-apps').innerHTML = `
    <h1>Apps</h1>
    <p class="ayuda">Productos que vendes: APK, web u otro.</p>
    <form id="form-app" class="tarjeta">
      <h2>${edit ? 'Editar app' : 'Nueva app'}</h2>
      <label>Nombre <input name="nombre" required value="${esc(edit?.nombre || '')}"></label>
      <label>Tipo
        <select name="tipo">
          <option value="apk" ${!edit || edit.tipo === 'apk' ? 'selected' : ''}>APK</option>
          <option value="web" ${edit?.tipo === 'web' ? 'selected' : ''}>Web</option>
          <option value="otro" ${edit?.tipo === 'otro' ? 'selected' : ''}>Otro</option>
        </select>
      </label>
      <label>Descripción <textarea name="descripcion">${esc(edit?.descripcion || '')}</textarea></label>
      <div class="fila-botones">
        <button type="submit">${edit ? 'Actualizar' : 'Guardar'}</button>
        <button type="button" id="app-cancelar" class="secundario" ${edit ? '' : 'hidden'}>Cancelar</button>
      </div>
    </form>
    ${state.apps.length ? `<div class="tabla-wrap"><table class="resp">
      <thead><tr><th>Nombre</th><th>Tipo</th><th>Descripción</th><th></th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>` : '<p class="vacio">No hay apps.</p>'}`;
  $('#form-app').addEventListener('submit', guardarApp);
  $('#app-cancelar')?.addEventListener('click', () => { state.editApp = null; renderApps(); });
  $('#vista-apps').querySelectorAll('[data-editar]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.editApp = state.apps.find((a) => a.id === btn.getAttribute('data-editar')) || null;
      renderApps();
      $('#form-app')?.scrollIntoView({ block: 'start' });
    });
  });
  $('#vista-apps').querySelectorAll('[data-borrar]').forEach((btn) => {
    btn.addEventListener('click', () => borrarApp(btn.getAttribute('data-borrar')));
  });
}

async function guardarApp(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const btn = form.querySelector('[type="submit"]');
  const payload = {
    nombre: form.nombre.value.trim(),
    tipo: form.tipo.value,
    descripcion: form.descripcion.value.trim() || null
  };
  btn.disabled = true;
  const q = state.editApp
    ? sb.from('apps').update(payload).eq('id', state.editApp.id)
    : sb.from('apps').insert(payload);
  const { error } = await q;
  btn.disabled = false;
  if (error) { mostrarAviso($('#app-msg'), errorTexto(error)); return; }
  state.editApp = null;
  await recargar();
}

async function borrarApp(id) {
  const app = state.apps.find((a) => a.id === id);
  if (!confirm(`¿Eliminar ${app?.nombre || 'esta app'}?`)) return;
  const { error } = await sb.from('apps').delete().eq('id', id);
  if (error) { mostrarAviso($('#app-msg'), errorTexto(error)); return; }
  if (state.editApp?.id === id) state.editApp = null;
  await recargar();
}

function renderClientes() {
  const edit = state.editCliente;
  const filas = state.clientes.map((c) => `
    <tr>
      <td data-label="Nombre">${esc(c.nombre)}</td>
      <td data-label="Documento">${esc(c.documento || '—')}</td>
      <td data-label="Teléfono">${esc(c.telefono || '—')}</td>
      <td data-label="Correo">${esc(c.email || '—')}</td>
      <td class="acciones" data-label="">
        <button type="button" class="secundario chico" data-editar="${esc(c.id)}">Editar</button>
        <button type="button" class="peligro chico" data-borrar="${esc(c.id)}">Eliminar</button>
      </td>
    </tr>`).join('');
  $('#vista-clientes').innerHTML = `
    <h1>Clientes</h1>
    <p class="ayuda">Personas o empresas que compran una app.</p>
    <form id="form-cliente" class="tarjeta">
      <h2>${edit ? 'Editar cliente' : 'Nuevo cliente'}</h2>
      <div class="grid-2">
        <label class="ancho">Nombre <input name="nombre" required value="${esc(edit?.nombre || '')}"></label>
        <label>Documento <input name="documento" value="${esc(edit?.documento || '')}"></label>
        <label>Teléfono <input name="telefono" value="${esc(edit?.telefono || '')}"></label>
        <label>Correo <input name="email" type="email" value="${esc(edit?.email || '')}"></label>
        <label class="ancho">Notas <textarea name="notas">${esc(edit?.notas || '')}</textarea></label>
      </div>
      <div class="fila-botones">
        <button type="submit">${edit ? 'Actualizar' : 'Guardar'}</button>
        <button type="button" id="cliente-cancelar" class="secundario" ${edit ? '' : 'hidden'}>Cancelar</button>
      </div>
    </form>
    ${state.clientes.length ? `<div class="tabla-wrap"><table class="resp">
      <thead><tr><th>Nombre</th><th>Documento</th><th>Teléfono</th><th>Correo</th><th></th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>` : '<p class="vacio">No hay clientes.</p>'}`;
  $('#form-cliente').addEventListener('submit', guardarCliente);
  $('#cliente-cancelar')?.addEventListener('click', () => { state.editCliente = null; renderClientes(); });
  $('#vista-clientes').querySelectorAll('[data-editar]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.editCliente = state.clientes.find((c) => c.id === btn.getAttribute('data-editar')) || null;
      renderClientes();
      $('#form-cliente')?.scrollIntoView({ block: 'start' });
    });
  });
  $('#vista-clientes').querySelectorAll('[data-borrar]').forEach((btn) => {
    btn.addEventListener('click', () => borrarCliente(btn.getAttribute('data-borrar')));
  });
}

async function guardarCliente(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const btn = form.querySelector('[type="submit"]');
  const limpio = (name) => form[name].value.trim() || null;
  const payload = {
    nombre: form.nombre.value.trim(),
    documento: limpio('documento'),
    telefono: limpio('telefono'),
    email: limpio('email'),
    notas: limpio('notas')
  };
  btn.disabled = true;
  const q = state.editCliente
    ? sb.from('clientes').update(payload).eq('id', state.editCliente.id)
    : sb.from('clientes').insert(payload);
  const { error } = await q;
  btn.disabled = false;
  if (error) { mostrarAviso($('#app-msg'), errorTexto(error)); return; }
  state.editCliente = null;
  await recargar();
}

async function borrarCliente(id) {
  const c = state.clientes.find((x) => x.id === id);
  if (!confirm(`¿Eliminar a ${c?.nombre || 'este cliente'}?`)) return;
  const { error } = await sb.from('clientes').delete().eq('id', id);
  if (error) { mostrarAviso($('#app-msg'), errorTexto(error)); return; }
  if (state.editCliente?.id === id) state.editCliente = null;
  await recargar();
}

function renderVenta() {
  const listo = state.apps.length > 0 && state.clientes.length > 0;
  const apps = state.apps.map((a) => `<option value="${esc(a.id)}">${esc(a.nombre)}</option>`).join('');
  const clientes = state.clientes.map((c) => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join('');
  $('#vista-venta').innerHTML = `
    <h1>Nueva venta</h1>
    <p class="ayuda">Elige app, cliente y tipo de venta. Al guardar se crea la clave para copiar.</p>
    ${listo ? '' : '<p class="vacio">Antes crea una app en Apps y un cliente en Clientes.</p>'}
    <form id="form-venta" class="tarjeta" ${listo ? '' : 'hidden'}>
      <label>App que vendes <select name="app_id" required>${apps}</select></label>
      <label>Cliente <select name="cliente_id" required>${clientes}</select></label>
      <fieldset>
        <legend>Tipo de venta</legend>
        <div class="opciones">
          <label><input type="radio" name="modalidad" value="licencia" checked> Licencia con vencimiento</label>
          <label><input type="radio" name="modalidad" value="venta_total"> Venta total, sin vencimiento</label>
        </div>
      </fieldset>
      <p id="ayuda-modalidad" class="ayuda">La licencia vence y después se puede renovar.</p>
      <div id="bloque-duracion">
        <fieldset>
          <legend>¿Por cuánto tiempo?</legend>
          <div class="opciones">
            <label><input type="radio" name="duracion" value="1" checked> 1 mes</label>
            <label><input type="radio" name="duracion" value="3"> 3 meses</label>
            <label><input type="radio" name="duracion" value="6"> 6 meses</label>
            <label><input type="radio" name="duracion" value="12"> 12 meses</label>
            <label><input type="radio" name="duracion" value="fecha"> Elegir fecha</label>
          </div>
        </fieldset>
        <label id="campo-fecha">Fecha de vencimiento <input type="date" name="fecha_vencimiento"></label>
      </div>
      <div class="grid-2">
        <label>Precio en soles <input name="precio" type="number" min="0" step="0.01" inputmode="decimal" required value="0"></label>
        <label>Fecha de la venta <input name="fecha_venta" type="date" required></label>
      </div>
      <label>Notas, opcional <textarea name="notas" placeholder="Algo que quieras recordar de esta venta"></textarea></label>
      <button type="submit">Guardar y generar clave</button>
    </form>`;
  const form = $('#form-venta');
  if (!form) return;
  form.fecha_venta.value = isoHoy();
  const sync = () => {
    const total = form.modalidad.value === 'venta_total';
    $('#bloque-duracion').hidden = total;
    $('#ayuda-modalidad').textContent = total
      ? 'La venta total no vence. Igual se genera una clave.'
      : 'La licencia vence y después se puede renovar.';
    const porFecha = form.duracion.value === 'fecha';
    $('#campo-fecha').hidden = total || !porFecha;
    form.fecha_vencimiento.required = !total && porFecha;
  };
  form.addEventListener('change', sync);
  form.addEventListener('submit', guardarVenta);
  sync();
}

async function guardarVenta(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const btn = form.querySelector('[type="submit"]');
  const modalidad = form.modalidad.value;
  const fecha = form.fecha_venta.value;
  let vencimiento = null;
  if (modalidad === 'licencia') {
    vencimiento = form.duracion.value === 'fecha'
      ? form.fecha_vencimiento.value
      : sumarMeses(fecha, Number(form.duracion.value));
    if (!vencimiento || vencimiento < fecha) {
      mostrarAviso($('#app-msg'), 'La fecha de vencimiento tiene que ser igual o posterior a la venta.');
      return;
    }
  }
  btn.disabled = true;
  mostrarAviso($('#app-msg'), '');
  const { data: venta, error } = await sb.from('ventas').insert({
    app_id: form.app_id.value,
    cliente_id: form.cliente_id.value,
    modalidad,
    precio: Number(form.precio.value),
    moneda: 'PEN',
    fecha_venta: fecha,
    notas: form.notas.value.trim() || null
  }).select('id').single();
  if (error || !venta) {
    btn.disabled = false;
    mostrarAviso($('#app-msg'), errorTexto(error));
    return;
  }
  let lic = null;
  let licError = null;
  let clave = '';
  for (let i = 0; i < 5 && !lic; i++) {
    clave = claveLicencia();
    const res = await sb.from('licencias').insert({
      venta_id: venta.id,
      clave,
      fecha_inicio: fecha,
      fecha_vencimiento: vencimiento,
      estado: 'activa'
    }).select('id, clave').single();
    if (!res.error) lic = res.data;
    else if (res.error.code !== '23505') { licError = res.error; break; }
  }
  if (!lic) {
    await sb.from('ventas').delete().eq('id', venta.id);
    btn.disabled = false;
    mostrarAviso($('#app-msg'), errorTexto(licError || { message: 'No se pudo generar la clave.' }));
    return;
  }
  btn.disabled = false;
  await recargar();
  mostrarClave(lic.clave);
}

function mostrarClave(clave) {
  abrirDialogo({
    titulo: 'Licencia creada',
    cuerpo: `<p>Guarda esta clave. También queda en Licencias.</p><p class="clave-box" id="clave-nueva">${esc(clave)}</p><button type="button" id="btn-copiar-clave">Copiar</button>`,
    cancelar: 'Cerrar',
    ocultarOk: true
  });
  $('#btn-copiar-clave').addEventListener('click', () => copiar(clave, $('#btn-copiar-clave')));
}

function licenciasFiltradas() {
  const q = filtros.texto.trim().toLowerCase();
  return fichas().filter((f) => {
    if (filtros.estado && f.lic.estado !== filtros.estado) return false;
    if (filtros.plazo === 'pronto' && !(f.dias != null && f.dias >= 0 && f.dias <= 15)) return false;
    if (filtros.plazo === 'vencidas' && !(f.dias != null && f.dias < 0)) return false;
    if (filtros.plazo === 'vigentes' && !(f.dias == null || f.dias >= 0)) return false;
    if (filtros.plazo === 'sin' && f.dias != null) return false;
    if (!q) return true;
    const blob = `${f.lic.clave} ${f.app?.nombre || ''} ${f.cli?.nombre || ''}`.toLowerCase();
    return blob.includes(q);
  });
}

function renderLicencias(resetShell) {
  const sec = $('#vista-licencias');
  if (resetShell || !$('#lista-licencias', sec)) {
    sec.innerHTML = `
      <h1>Licencias</h1>
      <p class="ayuda">Busca una clave, renueva, suspende o revoca.</p>
      <div class="filtros">
        <input id="f-texto" type="search" placeholder="Buscar clave, app o cliente" value="${esc(filtros.texto)}">
        <select id="f-estado">
          <option value="">Todos los estados</option>
          <option value="activa">Activa</option>
          <option value="suspendida">Suspendida</option>
          <option value="revocada">Revocada</option>
        </select>
        <select id="f-plazo">
          <option value="">Cualquier plazo</option>
          <option value="pronto">Por vencer (15 días)</option>
          <option value="vencidas">Vencidas</option>
          <option value="vigentes">Vigentes</option>
          <option value="sin">Sin vencimiento</option>
        </select>
      </div>
      <div id="lista-licencias"></div>`;
    $('#f-estado').value = filtros.estado;
    $('#f-plazo').value = filtros.plazo;
    const aplicar = () => {
      filtros.texto = $('#f-texto').value;
      filtros.estado = $('#f-estado').value;
      filtros.plazo = $('#f-plazo').value;
      pintarListaLicencias();
    };
    $('#f-texto').addEventListener('input', aplicar);
    $('#f-estado').addEventListener('change', aplicar);
    $('#f-plazo').addEventListener('change', aplicar);
  }
  pintarListaLicencias();
}

function pintarListaLicencias() {
  const items = licenciasFiltradas();
  const filas = items.map((f) => {
    const renovar = f.lic.estado === 'revocada' ? '' : `<button type="button" class="chico" data-renovar="${esc(f.lic.id)}">Renovar</button>`;
    const suspender = f.lic.estado === 'activa' ? `<button type="button" class="secundario chico" data-suspender="${esc(f.lic.id)}">Suspender</button>` : '';
    const revocar = f.lic.estado === 'revocada' ? '' : `<button type="button" class="peligro chico" data-revocar="${esc(f.lic.id)}">Revocar</button>`;
    return `<tr>
      <td data-label="Clave"><span class="mono">${esc(f.lic.clave)}</span> <button type="button" class="secundario chico" data-copiar="${esc(f.lic.clave)}">Copiar</button></td>
      <td data-label="App">${esc(f.app?.nombre || '—')}</td>
      <td data-label="Cliente">${esc(f.cli?.nombre || '—')}</td>
      <td data-label="Modalidad">${esc(textoModalidad(f.v.modalidad))}</td>
      <td data-label="Precio">${esc(pen(f.v.precio))}</td>
      <td data-label="Vencimiento">${esc(f.lic.fecha_vencimiento ? fechaCorta(f.lic.fecha_vencimiento) : 'Sin vencimiento')}</td>
      <td data-label="Días" class="dias ${claseDias(f.dias)}">${esc(textoDias(f.dias))}</td>
      <td data-label="Estado"><span class="badge ${esc(f.lic.estado)}">${esc(textoEstado(f.lic.estado))}</span></td>
      <td class="acciones" data-label="">${renovar}${suspender}${revocar}</td>
    </tr>`;
  }).join('');
  const vacio = state.licencias.length ? 'No hay licencias con ese filtro.' : 'No hay licencias.';
  $('#lista-licencias').innerHTML = items.length ? `<div class="tabla-wrap"><table class="resp">
    <thead><tr><th>Clave</th><th>App</th><th>Cliente</th><th>Modalidad</th><th>Precio</th><th>Vencimiento</th><th>Días</th><th>Estado</th><th></th></tr></thead>
    <tbody>${filas}</tbody>
  </table></div>` : `<p class="vacio">${vacio}</p>`;
  const root = $('#lista-licencias');
  root.querySelectorAll('[data-copiar]').forEach((btn) => {
    btn.addEventListener('click', () => copiar(btn.getAttribute('data-copiar'), btn));
  });
  root.querySelectorAll('[data-renovar]').forEach((btn) => {
    btn.addEventListener('click', () => abrirRenovar(btn.getAttribute('data-renovar')));
  });
  root.querySelectorAll('[data-suspender]').forEach((btn) => {
    btn.addEventListener('click', () => cambiarEstado(btn.getAttribute('data-suspender'), 'suspendida'));
  });
  root.querySelectorAll('[data-revocar]').forEach((btn) => {
    btn.addEventListener('click', () => cambiarEstado(btn.getAttribute('data-revocar'), 'revocada'));
  });
}

function abrirRenovar(id) {
  const f = fichas().find((x) => x.lic.id === id);
  if (!f) return;
  const base = f.lic.fecha_vencimiento && f.dias != null && f.dias >= 0 ? f.lic.fecha_vencimiento : isoHoy();
  const sugerida = sumarMeses(base, 1);
  abrirDialogo({
    titulo: 'Renovar licencia',
    cuerpo: `<p>${esc(f.lic.clave)} · ${esc(f.cli?.nombre || '')}</p>
      <label>Nuevo vencimiento <input id="ren-fecha" type="date" required value="${esc(sugerida)}"></label>
      <label>Monto (S/) <input id="ren-monto" type="number" min="0" step="0.01" required value="0"></label>`,
    ok: 'Renovar',
    onOk: async () => {
      const fecha = $('#ren-fecha').value;
      const monto = Number($('#ren-monto').value);
      if (!fecha) return false;
      const ins = await sb.from('renovaciones').insert({
        licencia_id: id,
        vencimiento_anterior: f.lic.fecha_vencimiento,
        vencimiento_nuevo: fecha,
        monto,
        fecha: isoHoy()
      }).select('id').single();
      if (ins.error) throw ins.error;
      const up = await sb.from('licencias').update({
        fecha_vencimiento: fecha,
        estado: 'activa'
      }).eq('id', id);
      if (up.error) {
        await sb.from('renovaciones').delete().eq('id', ins.data.id);
        throw up.error;
      }
      await recargar();
    }
  });
}

async function cambiarEstado(id, estado) {
  const verbo = estado === 'suspendida' ? 'Suspender' : 'Revocar';
  if (!confirm(`¿${verbo} esta licencia?`)) return;
  const { error } = await sb.from('licencias').update({ estado }).eq('id', id);
  if (error) { mostrarAviso($('#app-msg'), errorTexto(error)); return; }
  await recargar();
}

function abrirDialogo({ titulo, cuerpo, ok, cancelar, ocultarOk, onOk }) {
  $('#dialogo-titulo').textContent = titulo;
  $('#dialogo-cuerpo').innerHTML = cuerpo;
  const btnOk = $('#dialogo-ok');
  const btnCancel = $('#dialogo-cancelar');
  btnOk.hidden = !!ocultarOk;
  btnOk.textContent = ok || 'Guardar';
  btnCancel.textContent = cancelar || 'Cancelar';
  const form = $('#form-dialogo');
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    if (!onOk) { $('#dialogo').close(); return; }
    btnOk.disabled = true;
    try {
      const seguir = await onOk();
      if (seguir !== false) $('#dialogo').close();
    } catch (err) {
      mostrarAviso($('#app-msg'), errorTexto(err));
    } finally {
      btnOk.disabled = false;
    }
  };
  btnCancel.onclick = () => $('#dialogo').close();
  $('#dialogo').showModal();
}

function botonesLogin(ocupado) {
  $('#btn-entrar').disabled = ocupado;
  $('#btn-alta').disabled = ocupado;
}

$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#login-email').value.trim();
  const password = $('#login-clave').value;
  botonesLogin(true);
  mostrarAviso($('#login-msg'), '');
  try {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) mostrarAviso($('#login-msg'), errorTexto(error));
  } catch (err) {
    mostrarAviso($('#login-msg'), errorTexto(err));
  } finally {
    botonesLogin(false);
  }
});

$('#btn-alta').addEventListener('click', async () => {
  const form = $('#form-login');
  if (!form.reportValidity()) return;
  const email = $('#login-email').value.trim();
  const password = $('#login-clave').value;
  if (password.length < 6) {
    mostrarAviso($('#login-msg'), 'La contraseña debe tener al menos 6 caracteres.');
    return;
  }
  botonesLogin(true);
  mostrarAviso($('#login-msg'), '');
  try {
    const redirect = new URL('./', location.href).href;
    let { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirect }
    });
    if (error && /redirect/i.test(error.message)) {
      ({ data, error } = await sb.auth.signUp({ email, password }));
    }
    if (error) {
      mostrarAviso($('#login-msg'), 'No se pudo crear la cuenta. ' + errorTexto(error));
      return;
    }
    const nuevo = data.user && Array.isArray(data.user.identities) && data.user.identities.length > 0;
    if (!nuevo) {
      mostrarAviso($('#login-msg'), 'Esa cuenta ya existe. Pulsa Entrar con la misma contraseña.');
      return;
    }
    if (!data.session) mostrarCreada(email);
  } catch (err) {
    mostrarAviso($('#login-msg'), 'No se pudo crear la cuenta. ' + errorTexto(err));
  } finally {
    botonesLogin(false);
  }
});

$('#btn-ojo').addEventListener('click', () => {
  const input = $('#login-clave');
  const ver = input.type === 'password';
  input.type = ver ? 'text' : 'password';
  const btn = $('#btn-ojo');
  btn.setAttribute('aria-pressed', ver ? 'true' : 'false');
  btn.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
  btn.innerHTML = ver
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M3 3l18 18"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M10.5 10.7a3 3 0 0 0 4.2 4.2"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M9.9 5.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.2 4.2M6.1 6.7C3.6 8.6 2 12 2 12a18 18 0 0 0 6.2 5.3"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
});

$('#btn-creada-entrar').addEventListener('click', () => mostrarLogin());
$('#btn-salir').addEventListener('click', () => sb.auth.signOut());
$('#btn-salir-denegado').addEventListener('click', () => sb.auth.signOut());
$('#btn-copiar-id').addEventListener('click', () => copiar($('#denegado-id').textContent, $('#btn-copiar-id')));

window.addEventListener('hashchange', () => {
  if ($('#app').hidden) return;
  mostrarVista(location.hash.slice(1));
});

const espera = setTimeout(() => {
  if (!arranque) mostrarLogin('No se pudo conectar. Revisa la red e inténtalo de nuevo.');
}, 8000);

function iniciarSecciones() {
  const nav = $('#secciones');
  nav.innerHTML = SECCIONES.map((s, i) =>
    `<button type="button" data-seccion="${esc(s.id)}"${i === 0 ? ' aria-current="page"' : ''}>${esc(s.label)}</button>`
  ).join('');
  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-seccion]');
    if (!btn) return;
    const id = btn.getAttribute('data-seccion');
    nav.querySelectorAll('[data-seccion]').forEach((b) => {
      if (b === btn) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    let hay = false;
    document.querySelectorAll('[data-panel]').forEach((p) => {
      const activo = p.getAttribute('data-panel') === id;
      p.hidden = !activo;
      if (activo) hay = true;
    });
    const vacio = $('#panel-vacio');
    vacio.hidden = hay;
    vacio.textContent = hay ? '' : 'Esta sección todavía no está disponible.';
  });
}
iniciarSecciones();

async function aplicarSesion(session) {
  const id = session?.user?.id || '';
  if (mostrandoCreada && !session) return;
  if (arranque && sesionAplicada === id) return;
  sesionAplicada = id;
  arranque = true;
  clearTimeout(espera);
  try {
    if (session) await entrar(session);
    else mostrarLogin();
  } catch (err) {
    if (sesionAplicada === id) mostrarLogin(errorTexto(err));
  }
}

sb.auth.onAuthStateChange((event, session) => {
  if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
    aplicarSesion(session);
  }
});

sb.auth.getSession().then(({ data, error }) => {
  if (error) {
    arranque = true;
    clearTimeout(espera);
    mostrarLogin(errorTexto(error));
    return;
  }
  aplicarSesion(data.session);
}).catch(() => {
  if (!arranque) mostrarLogin('No se pudo conectar. Revisa la red e inténtalo de nuevo.');
});
