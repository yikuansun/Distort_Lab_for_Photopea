export function buildParamsPanel(root, filter, values, onChange) {
  root.innerHTML = "";
  const p = filter.params || {};
  for (const [key, def] of Object.entries(p)) {
    const wrap = document.createElement("div");
    wrap.className = "row";
    const label = document.createElement("label");
    label.textContent = def.label || key;
    label.htmlFor = `param_${key}`;
    wrap.appendChild(label);

    let input;
    if (def.type === "select") {
      input = document.createElement("select");
      for (const opt of def.options) {
        const o = document.createElement("option");
        o.value = String(opt);
        o.textContent = String(opt);
        input.appendChild(o);
      }
      input.value = String(values[key]);
    } else if (def.type === "checkbox") {
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!values[key];
    } else if (def.type === "number") {
      input = document.createElement("input");
      input.type = "number";
      if (def.min !== undefined) input.min = def.min;
      if (def.max !== undefined) input.max = def.max;
      if (def.step !== undefined) input.step = def.step;
      input.value = values[key];
    } else { // range default
      input = document.createElement("input");
      input.type = "range";
      if (def.min !== undefined) input.min = def.min;
      if (def.max !== undefined) input.max = def.max;
      if (def.step !== undefined) input.step = def.step;
      input.value = values[key];
    }
    input.id = `param_${key}`;
    input.addEventListener("input", () => {
      const v = (def.type === "checkbox") ? input.checked : input.value;
      onChange(key, v);
    });
    wrap.appendChild(input);

    if (def.hint) {
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = def.hint;
      wrap.appendChild(hint);
    }
    root.appendChild(wrap);
  }
}
