import { Select } from '@dynatrace/strato-components-preview/forms';

import React, {useEffect, useState} from 'react';


/** utilitário para ver se um value está na lista de opções */
const optionExists = (value: string, options: Option[]) =>
  options.some((o) => o.value === value);

export const SelectComponent = (select: SelectInterface) => {
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
};


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