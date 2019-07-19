/**
Run this function on page https://www.ecma-international.org/ecma-262/9.0/index.html#sec-runtime-semantics-unicodematchproperty-p
*/
function getUnicodeAliasMap() {
  let tableIdMap = {
    NonBinary_Property: 'table-nonbinary-unicode-properties',
    Binary_Property: 'table-binary-unicode-properties',
    General_Category: 'table-unicode-general-category-values',
    Script: 'table-unicode-script-values'
  };

  let mapping = {};
  for (let k in tableIdMap) {
    let id = tableIdMap[k];
    mapping[k] = get(id);
  }

  return JSON.stringify(mapping, null, 2);

  function get(id) {
    return getAliasInTable(document.getElementById(id));
  }

  function getAliasInTable(emuTable) {
    let table = emuTable.getElementsByClassName('unicode-property-table')[0];
    let rows = Array.from(table.tBodies[0].rows);
    let mapping = {};
    rows.forEach(tr => {
      let [cname, ...aliases] = Array.from(tr.cells[0].getElementsByTagName('code')).map(c => c.innerText);
      mapping[cname] = aliases.join(',');
    });
    return mapping;
  }
}
