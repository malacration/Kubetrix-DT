import { Select, type FormControlWithOverlayRef } from '@dynatrace/strato-components-preview/forms';

import React, {useEffect, useState, forwardRef} from 'react';


/** utilitário para ver se um value está na lista de opções */
const optionExists = (value: string, options: Option[]) =>
  options.some((o) => o.value === value);

// forwardRef: o FilterBar (e outros wrappers) injeta um ref no filho de cada
// FilterBar.Item para controlar foco/posicionamento do dropdown. Sem isso, o
// React avisa "Function components cannot be given refs" toda vez que este
// componente é usado dentro de um FilterBar.Item (ex.: "Resolution", "Auto Refresh").
export const SelectComponent = forwardRef<FormControlWithOverlayRef<HTMLDivElement>, SelectInterface>((select, ref) => {
  const {
    options,
    defaultValue,
    multiple = false,
    clearable = true,
    placeholder,
    filter = true,
    loading,
    onChange,
  } = select;

  const [selected, setSelected] = useState<string | string[] | null>(defaultValue);

  /* Atualiza apenas se o valor vigente desaparecer da nova lista de opções */
  useEffect(() => {
    if (selected == null) return; // nada selecionado → nada a fazer

    const allExist = Array.isArray(selected)
      ? selected.every((v) => optionExists(v, options))
      : optionExists(selected, options);

    if (!allExist) {
      handleChange(defaultValue ?? null);
    }
    
    maxLabel = Math.max(8,...(options?.flatMap(o => o.label.length) ?? []));
    overlayWidth = `${Math.min(maxLabel * 8, 400)}px`;

  }, [options, selected, defaultValue]);

  const handleChange = (value: string | string[] | null) => {
    setSelected(value);
    onChange?.(value);
  };

  let maxLabel = Math.max(8,...(options?.flatMap(o => o.label.length) ?? []));
  let overlayWidth = `${Math.min(maxLabel * 8, 400)}px`; // limite de 400 px

  return (
    (<Select
      ref={ref}
      value={selected}
      onChange={handleChange}
      multiple={multiple}
      clearable={clearable}
    >
      {filter && <Select.Filter />}
      <Select.Trigger style={{ minWidth: 150 }} placeholder={placeholder || 'Selecione...'} />
      <Select.Content style={{ minWidth: 150 }} width={overlayWidth} loading={loading} showSelectedOptionsFirst>
        {options.map((o) => (
          <Select.Option key={o.value} value={o.value}>
            {o.label}
          </Select.Option>
        ))}
      </Select.Content>
    </Select>)
  );
});

// @ts-expect-error o tipo inferido de forwardRef aqui não expõe displayName, mas a propriedade existe em runtime
SelectComponent.displayName = 'SelectComponent';


class SelectInterface {
  options: Option[] = [];
  defaultValue: string | string[] | null;
  clearable?: boolean;
  multiple?: boolean;
  loading?: boolean;
  placeholder?: string;
  filter?: boolean;
  style?: object;
  onChange?: (value: string | string[] | null | undefined) => void;
}


export class Option{
    
    value : string
    label : string

    constructor(label, value){
        this.label = label
        this.value = value
    }
}