import { Chip } from "@dynatrace/strato-components-preview/content"

export class Metrics{
  resource: string

  _cpuRequest: number // (request)+' Cores',
  _cpuLimit: number //' Cores',
  _memoryRequest: number //' GB',
  _memoryLimit: number
  podDesired : number
  cpuUsageMax : number
  cpuUsageAvg : number
  cpuThrottled : number    // max — detectar se ocorreu throttle; base para getMax
  cpuThrottledAvg : number // avg — magnitude típica; base para getMin e median
  memoryUsageMax: number
  memoryUsageAvg: number

  // Request/pod da configuração ATUAL do workload. Preenchido pela linha-pai nas
  // sub-linhas (MIN/Median/MAX/My) pra elas saberem contra o que comparar: a coluna
  // sobra/falta de uma sub-linha responde "se eu aplicar ESTA recomendação, quanto
  // libero em relação ao que está configurado hoje?".
  currentCpuRequestPerPod?: number
  currentMemoryRequestPerPod?: number

  constructor(resource){
    this.resource = resource
    this._cpuRequest = 0
    this._cpuLimit = 0
    this._memoryRequest = 0
    this._memoryLimit = 0
    this.cpuThrottled = 0
    this.cpuThrottledAvg = 0
  }

  // Sobra/falta genérica: vale pras sub-linhas de recomendação. MetricsGrouped
  // sobrescreve os dois *Raw abaixo, porque na linha-pai a comparação é contra o
  // USO real, não contra outra recomendação.
  get overUnderCpuRaw() : number {
    if(this.currentCpuRequestPerPod == null || !(this.podDesired > 0))
      return 0
    return (this.currentCpuRequestPerPod - this._cpuRequest) * this.podDesired
  }

  get overUnderCpu(){
    return this.cpuConverter(this.overUnderCpuRaw)
  }

  get overUnderMemoryRaw() : number {
    if(this.currentMemoryRequestPerPod == null || !(this.podDesired > 0))
      return 0
    return (this.currentMemoryRequestPerPod - this._memoryRequest) * this.podDesired
  }

  get overUnderMemory(){
    return this.fmtBytes(this.overUnderMemoryRaw)
  }


  cpuConverter(cpu : number){
    if(cpu == null || !isFinite(cpu))
      return undefined
    if(cpu == 0)
      return "none"
    // Math.abs na comparação: sem isso um valor NEGATIVO nunca passava do teste
    // (-2000 > 999.99 é falso) e -2 Cores saía escrito "-2000.00 mCore". A coluna
    // sobra/falta é justamente onde aparecem os negativos.
    if(Math.abs(cpu) > 999.99)
      return `${(cpu/1000).toFixed(2)} Core`
    return `${cpu.toFixed(2)} mCore`
  }

  isComplete() : boolean{
    if(this.cpuRequest != null &&
      this.cpuLimit != null &&
      this._memoryRequest != null &&
      this._memoryLimit != null &&
      this.podDesired != null &&
      this.cpuUsageMax != null &&
      this.cpuUsageAvg != null &&
      this.memoryUsageMax != null &&
      this.memoryUsageAvg != null &&
      this.cpuThrottled != null &&
      this.cpuThrottledAvg != null)
      return true
    else
      return false
  }
  
  get cpuRequest(): string | undefined {
      return this.cpuConverter(this._cpuRequest)
  }
  
  get cpuLimit(): string | undefined {
    return this.cpuConverter(this._cpuLimit)
  }

  get podCpuUsageAvg(){
    return this.cpuUsageAvg/this.podDesired
  }

  get podCpuUsageMax(){
    return this.cpuUsageMax/this.podDesired
  }

  get hasCpuThrottled() : boolean{
    return this.cpuThrottled > 0.1
  }

  get isLowCpuLimit() : boolean{
    return this.podCpuUsageMax < this._cpuLimit && this.hasCpuThrottled
  }

  // Helpers
  ONE_KiB = 1_024;
  ONE_MiB = 1_024 ** 2;
  ONE_GiB = 1_024 ** 3;
  ONE_TiB = 1_024 ** 4;

  /**
   * Converte bytes na maior unidade que ainda deixa o número legível (base 1024).
   * A escala é decidida pelo MÓDULO: antes o teste era `bytes >= ONE_GiB`, então
   * qualquer valor negativo caía direto no ramo de MiB e -17.4 GiB era exibido como
   * "-17847.48 MiB". A coluna sobra/falta é cheia de negativos.
   */
  fmtBytes(bytes : number): string | undefined {
    if(bytes == null || !isFinite(bytes))
      return undefined

    const abs = Math.abs(bytes)
    if(abs >= this.ONE_TiB)
      return `${(bytes / this.ONE_TiB).toFixed(2)} TiB`
    if(abs >= this.ONE_GiB)
      return `${(bytes / this.ONE_GiB).toFixed(2)} GiB`
    if(abs >= this.ONE_MiB)
      return `${(bytes / this.ONE_MiB).toFixed(2)} MiB`
    return `${(bytes / this.ONE_KiB).toFixed(2)} KiB`
  }


  get memoryRequest(){
    if(this._memoryRequest)
      return this.fmtBytes(this._memoryRequest)
    else
      return undefined
  }

  get memoryLimit(){
    if(this._memoryLimit)
      return this.fmtBytes(this._memoryLimit)
    else
      return undefined
  }
}


export class MetricsGrouped extends Metrics{
    metricKey: string
    cluster: string
    namespace: string
    workload: string
    private _normalized = false

    myCustomSubRows : Array<Metrics> = []

    constructor(dm){
      super('Atual')
      this.cluster   = dm["k8s.cluster.name"]
      this.namespace = dm["k8s.namespace.name"]
      this.workload  = dm["k8s.workload.name"]
    }
    

    get name(){
      return this.workload
    }

    // Na linha-pai a comparação é request configurado x USO real (não contra uma
    // recomendação), por isso sobrescreve a versão genérica de Metrics.
    override get overUnderCpuRaw() : number{
      if(this._cpuRequest > 0 && this.cpuUsageAvg > 0 && this.podDesired > 0){
        return (this._cpuRequest-this.cpuUsageAvg/this.podDesired)*this.podDesired
      }

      return 0
    }

    override get overUnderMemoryRaw() : number{
      if(this._memoryRequest > 0 && this.memoryUsageMax > 0 && this.podDesired > 0)
        return (this._memoryRequest-(this.memoryUsageMax*1.2)/this.podDesired)*this.podDesired
      return 0
    }

    // ---- Ranking de economia -------------------------------------------------
    // O que se recupera de capacidade do cluster é o REQUEST, não o limit: o
    // scheduler do K8s reserva nó por request; limit só age em runtime (throttle de
    // CPU, OOM kill) e não reserva nada. Por isso os dois getters abaixo derivam de
    // overUnder*Raw, que já são calculados sobre request.
    // Unidades cruas: cpu_usage/requests_cpu em MilliCores, memory_* em Bytes.

    /** Economia de CPU do workload inteiro, em Cores. Positivo = dá pra reduzir. */
    get cpuSavingCores() : number {
      return this.overUnderCpuRaw / 1000
    }

    /** Economia de memória do workload inteiro, em GiB. Positivo = dá pra reduzir. */
    get memorySavingGiB() : number {
      return this.overUnderMemoryRaw / this.ONE_GiB
    }

    /**
     * Score único pra ranquear CPU e memória na mesma lista — sem ele não dá pra
     * ordenar por "maior ganho geral", só por um recurso de cada vez.
     * Converte memória em "equivalente de core" na proporção 1 core : 4 GiB, que é a
     * razão vCPU/RAM da maioria dos tipos de instância cloud (e5/m5/n2/Standard_D).
     *
     * Saldo LÍQUIDO, com sinal: um recurso em falta abate o que sobra no outro.
     * Antes cada parcela tinha piso zero, e um workload com 2 Cores sobrando e 8 GiB
     * faltando pontuava 2.00 — o déficit sumia da coluna e ele subia no ranking como
     * bom candidato a corte. Negativo agora afunda na ordenação, que é onde ele deve
     * estar, e casa com os cards do topo, que também mostram saldo com sinal.
     */
    get capacityScore() : number {
      return this.cpuSavingCores + this.memorySavingGiB / 4
    }

    /** Rótulo do score pra coluna — em "cores equivalentes". */
    get capacityScoreLabel() : string {
      const score = this.capacityScore
      // Faixa morta: abaixo de 0.01 eq. Core não há o que agir, e "-0.00" polui.
      if(Math.abs(score) < 0.01)
        return "—"
      return `${score.toFixed(2)} eq. Core`
    }

    set(metricId : string, values : any[]) {
      if(metricId.includes("cpu_usage") && metricId.includes("max"))
        this.cpuUsageMax = Number(values[0].toFixed(2))

      if(metricId.includes("cpu_usage") && metricId.includes("avg"))
        this.cpuUsageAvg = Number(values[0].toFixed(2))

      if(metricId.includes("pods_desired"))
        this.podDesired = Number(values[0].toFixed(2))

      if(metricId.includes("limits_cpu")){
        this._cpuLimit = Number(values[0].toFixed(2))
      }
        

      if(metricId.includes("requests_cpu"))
        this._cpuRequest = Number(values[0].toFixed(2))
      
      if(metricId.includes("cpu_throttled") && !metricId.includes("avg"))
        this.cpuThrottled = Number(values[0].toFixed(2))

      if(metricId.includes("cpu_throttled") && metricId.includes("avg"))
        this.cpuThrottledAvg = Number(values[0].toFixed(2))

      if(metricId.includes("limits_memory"))
        this._memoryLimit = Number(values[0].toFixed(2))
      
      if(metricId.includes("requests_memory"))
        this._memoryRequest = Number(values[0].toFixed(2))


      if(metricId.includes("memory_working_set") && metricId.includes("max")){
        this.memoryUsageMax = Number(values[0].toFixed(2))
      }

      if(metricId.includes("memory_working_set") && metricId.includes("avg"))
        this.memoryUsageAvg = Number(values[0].toFixed(2))
      

      if(this.isComplete() && !this._normalized){
        this._normalized = true

        this._cpuRequest = Number((this._cpuRequest/this.podDesired).toFixed(2))
        this._cpuLimit = Number((this._cpuLimit/this.podDesired).toFixed(2))

        this._memoryLimit = this._memoryLimit/this.podDesired
        this._memoryRequest = this._memoryRequest/this.podDesired

        this.myCustomSubRows = [this.getMin(),this.median(),this.getMax(),this.myRecomendation()]

        // Só depois da normalização: aqui _cpuRequest/_memoryRequest já são por pod,
        // mesma base das recomendações, então a subtração fecha. Sem isso a coluna
        // sobra/falta ficava vazia nas sub-linhas.
        this.myCustomSubRows.forEach(sub => {
          sub.currentCpuRequestPerPod = this._cpuRequest
          sub.currentMemoryRequestPerPod = this._memoryRequest
        })
      }
    }

    getMin() : Metrics{
      const metric = new Metrics("MIN")
      metric.podDesired = this.podDesired
      
      metric._cpuRequest = Number(((this.cpuUsageAvg/this.podDesired)*1.1).toFixed(2))
      if(this.isLowCpuLimit)
        metric._cpuLimit = this._cpuLimit+(this.cpuThrottledAvg/this.podDesired)
      else
        metric._cpuLimit = Number(((this.cpuUsageAvg+this.cpuThrottledAvg)/this.podDesired).toFixed(2))

      const memory = (this.memoryUsageAvg/this.podDesired)*1.05
      metric._memoryRequest = memory
      metric._memoryLimit = memory
      return metric
    }

    getMax() : Metrics{
      const metric = new Metrics("MAX")
      metric.podDesired = this.podDesired

      metric._cpuRequest = Number(((this.cpuUsageAvg/this.podDesired)*1.2).toFixed(2))
      if(this.isLowCpuLimit)
        metric._cpuLimit = this._cpuLimit+(this.cpuThrottled/this.podDesired)*1.1
      else
        metric._cpuLimit = Number((((this.cpuUsageMax+this.cpuThrottled)/this.podDesired)*1.2).toFixed(2))

      const memory = (this.memoryUsageMax/this.podDesired)*1.2

      metric._memoryRequest = memory
      metric._memoryLimit = memory
      
      return metric
    }

    median() : Metrics{
      const metric = new Metrics("Median")
      metric.podDesired = this.podDesired

      metric._cpuRequest = Number(((this.cpuUsageAvg/this.podDesired)*1.1).toFixed(2))

      if(this.isLowCpuLimit)
        metric._cpuLimit = this._cpuLimit+(this.cpuThrottledAvg/this.podDesired)*1.1
      else {
        const cpuMidpoint = (this.cpuUsageAvg + this.cpuUsageMax) / 2
        metric._cpuLimit = Number((((cpuMidpoint+this.cpuThrottledAvg)/this.podDesired)*1.1).toFixed(2))
      }

      const memory = (this.memoryUsageMax/this.podDesired)*1.1
      metric._memoryRequest = memory
      metric._memoryLimit = memory

      return metric
    }

    myRecomendation() : Metrics{
      const metric = new Metrics("My")
      metric.podDesired = this.podDesired

      metric._cpuRequest = Number(((this.cpuUsageAvg/this.podDesired)*1.2).toFixed(2))
      metric._cpuLimit = 0


      const memory = (this.memoryUsageMax/this.podDesired)*1.2
      metric._memoryRequest = memory
      metric._memoryLimit = memory
      
      return metric
    }

    getRecommendationTag(): string {
      const cpuPerPodMax = this.cpuUsageMax / this.podDesired;
      const memPerPodMax = this.memoryUsageMax / this.podDesired;
      const cpuWaste = cpuPerPodMax < 0.5 * this._cpuRequest;
      const memWaste = memPerPodMax < 0.5 * this._memoryRequest;

      // Os testes de "precisa mais" só valem contra um limit REAL. Sem essa guarda,
      // limit ausente (=0) faz `x >= 0.9*0` ser sempre verdadeiro e TODO workload sem
      // limit — que é a maioria em muitos clusters — era rotulado "Precisa mais",
      // escondendo justamente os candidatos a redução.
      // O throttle usa hasCpuThrottled (>0.1) e não `> 0`, senão qualquer resíduo
      // desprezível de throttle já classificava o workload como carente.
      const cpuNeed = (this._cpuLimit > 0 && cpuPerPodMax >= 0.9 * this._cpuLimit) || this.hasCpuThrottled;
      const memNeed = this._memoryLimit > 0 && memPerPodMax >= 0.9 * this._memoryLimit;

      if ((cpuWaste || memWaste) && !cpuNeed && !memNeed) {
        return "Pode reduzir";
      }

      if (cpuNeed || memNeed) {
        return "Precisa mais";
      }

      return "Ajustado";
    }

    getRecommendationChip() : ChipValues {
      const label = this.getRecommendationTag()
      if(label == "Pode reduzir")
        return { label, color: "success" }
      if(label == "Precisa mais")
        return { label, color: "critical" }
      return { label, color: "neutral" }
    }
    
    getChips() : Array<ChipValues> {
      const all : Array<ChipValues> = []
      
      if(this.hasCpuThrottled)
        all.push({label: 'Throttled', color: "critical"})

      if(this.overUnderCpuRaw > 0)
        all.push({label: 'Overprovisioned - CPU', color: "warning"})

      if(this.overUnderCpuRaw < 0)
        all.push({label: 'Underprovisioned - CPU', color: "warning"})

      if(this.overUnderMemoryRaw > 0)
        all.push({label: 'Overprovisioned - Memory', color: "warning"})

      if(this.overUnderMemoryRaw < 0)
        all.push({label: 'Underprovisioned - Memory', color: "warning"})

      if(this._memoryRequest != this._memoryLimit)
        all.push({label: 'Unbalanced memory', color: "warning"})

      if(this.isLowCpuLimit)
        all.push({label: 'Low CPU Limit', color: "critical"})

      // request == limit nos dois recursos = QoS Guaranteed (última classe a ser
      // despejada sob pressão de nó). Isso é uma qualidade, não um defeito — antes
      // era emitido aqui como um segundo 'Low CPU Limit' crítico, o que marcava
      // indevidamente workloads bem configurados. Fica como aviso porque baixar o
      // request pela recomendação REBAIXA o pod pra Burstable.
      if(this._cpuRequest == this._cpuLimit && this._memoryRequest == this._memoryLimit)
        all.push({label: 'QoS Guaranteed — reduzir request rebaixa p/ Burstable', color: "neutral"})

      return all
    }
}

export class ChipValues{
  label: string
  color : 'neutral' | 'primary' | 'success' | 'warning' | 'critical'

}
