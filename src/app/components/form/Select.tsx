import React, {useEffect, useState} from 'react';


import { SelectV2 } from '@dynatrace/strato-components-preview/forms';

export const SelectComponent = (select: Select) => {

  const [selected, setSelected] = useState<string | string[] | null>(select.defaultValue);

  useEffect(() => {
    setSelected(null);
  }, [select.options]);

  const handleChange = (value: string | string[] | null) => {
    setSelected(value);
    select?.onChange(value);
  };

  return (
    <SelectV2
      onChange={handleChange}
      clearable={select.clearable ?? true} 
      multiple={select.multiple ?? false} 
      value={selected as any}
      >

      {select.filter ?? true ? <SelectV2.Filter /> : null}
      {select.placeholder ? <SelectV2.Trigger placeholder={select.placeholder} /> : <></>}
      
      <SelectV2.Content 
        loading={select.loading}
        showSelectedOptionsFirst={true}
        >
        {select.options.map((el) => (
            <SelectV2.Option value={el.value} key={el.value}>
              {el.label}
            </SelectV2.Option>
          ))}
      </SelectV2.Content>

    </SelectV2>
  );
};


class Select {
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