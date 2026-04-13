/* MELI — No D3 charts defined */
function _initD3Charts() {
  if (typeof SS_D3 !== 'undefined') SS_D3.renderSparklines();
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',_initD3Charts)}else{_initD3Charts()}
