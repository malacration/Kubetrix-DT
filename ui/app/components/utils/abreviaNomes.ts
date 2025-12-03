

export function replaceHostNames(host : string) : string{
    const replaces =[
        "ocp-",
        "prd2-",
        "prd1-",
        ".ocp-prd1.tjro.jus.br",
        ".ocp-prd2.tjro.jus.br",
        ".tjro.net",
        ".pjro.local",
        "xwxcf-"
    ]
    replaces.forEach(it => host = host.replace(it,""))
    return host
}