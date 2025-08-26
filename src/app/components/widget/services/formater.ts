import { format as uformat, units } from '@dynatrace-sdk/units';

export const timeFormatter = {
    input: units.time.microsecond,
    output: units.time.millisecond,
    abbreviate: true,
    minimumFractionDigits: 1,
    maximumFractionDigits: 3,
}

export const countFormatter = {
    abbreviate: true,
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
}


export function microToMileSeconds(valueInMicros){
    return uformat(valueInMicros, {
        input: units.time.microsecond,
        output: units.time.millisecond,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        abbreviate: false,
    })
}



export function countAbreviation(valueInMicros){
    return uformat(valueInMicros, {
        abbreviate: true,
        minimumFractionDigits: 2,
        maximumFractionDigits: 3,
    })
}