export class Metrics{
  resource: string

  _cpuRequest: number // (request)+' Cores',
  _cpuLimit: number //' Cores',
  _memoryRequest: number //' GB',
  _memoryLimit: number 
  podDesired : number
  cpuUsageMax : number
  cpuUsageAvg : number
  cpuThrottled : number
  memoryUsageMax: number
  memoryUsageAvg: number

  constructor(resource){
    this.resource = resource
    this._cpuRequest = 0
    this._cpuLimit = 0
    this._memoryRequest = 0
    this._memoryLimit = 0
    this.cpuThrottled = 0
  }


  isComplete() : boolean{
    if(this.cpuRequest != null && 
      this.cpuLimit != null && 
      this._memoryRequest != null && 
      this._memoryLimit != null && 
      this.podDesired != null && 
      this.cpuUsageMax != null && 
      this.memoryUsageMax != null && 
      this.memoryUsageAvg != null &&
      this.cpuThrottled != null)
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

  cpuConverter(cpu : number){
    if(cpu == 0)
      return "none"
    return cpu != null
      ? `${cpu} mCore`
      : undefined;
  }

  // Helpers (mantém tudo DRY)
  ONE_MiB = 1_024 ** 2;     // 1 048 576  B
  ONE_GiB = 1_024 ** 3;     // 1 073 741 824 B

  /** Converte bytes em string “N.nn GiB” ou “N.nn MiB”  */
  fmtBytes(bytes?: number): string | undefined {
    if (bytes == null) return undefined;                // null ou undefined

    return bytes >= this.ONE_GiB
      ? `${(bytes / this.ONE_GiB).toFixed(2)} GiB`
      : `${(bytes / this.ONE_MiB).toFixed(2)} MiB`;
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

    myCustomSubRows : Array<Metrics> = []

    

    constructor(dm){
      super('Definition')
      this.cluster   = dm["k8s.cluster.name"]
      this.namespace = dm["k8s.namespace.name"]
      this.workload  = dm["k8s.workload.name"]
    }
    

    get name(){
      return this.workload
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
      
      if(metricId.includes("cpu_throttled"))
        this.cpuThrottled = Number(values[0].toFixed(2))

      if(metricId.includes("limits_memory"))
        this._memoryLimit = Number(values[0].toFixed(2))
      
      if(metricId.includes("requests_memory"))
        this._memoryRequest = Number(values[0].toFixed(2))


      if(metricId.includes("memory_working_set") && metricId.includes("max")){
        this.memoryUsageMax = Number(values[0].toFixed(2))
      }

      if(metricId.includes("memory_working_set") && metricId.includes("avg"))
        this.memoryUsageAvg = Number(values[0].toFixed(2))
      

      if(this.isComplete()){
        this._cpuRequest = Number((this._cpuRequest/this.podDesired).toFixed(2))
        this._cpuLimit = Number((this._cpuLimit/this.podDesired).toFixed(2))
        
        this._memoryLimit = this._memoryLimit/this.podDesired
        this._memoryRequest = this._memoryRequest/this.podDesired
        
        this.myCustomSubRows = [this.getMin(),this.getMax(),this.myRecomendation()]
      }
    }

    getMin() : Metrics{
      const metric = new Metrics("Recommended (MIN)")
      metric.podDesired = this.podDesired
      
      metric._cpuRequest = Number(((this.cpuUsageAvg/this.podDesired)).toFixed(2))
      metric._cpuLimit = Number(((this.cpuUsageAvg+this.cpuThrottled)/this.podDesired).toFixed(2))

      const memory = (this.memoryUsageAvg/this.podDesired)*1.2
      metric._memoryRequest = memory
      metric._memoryLimit = memory
      return metric
    }

    getMax() : Metrics{
      const metric = new Metrics("Recommended (MAX)")
      metric.podDesired = this.podDesired

      metric._cpuRequest = Number(((this.cpuUsageAvg/this.podDesired)*1.2).toFixed(2))
      metric._cpuLimit = Number((((this.cpuUsageMax+this.cpuThrottled)/this.podDesired)*1.2).toFixed(2))


      const memory = (this.memoryUsageMax/this.podDesired)*1.2
      metric._memoryRequest = memory
      metric._memoryLimit = memory
      
      return metric
    }

    myRecomendation() : Metrics{
      const metric = new Metrics("Recommended (My)")
      metric.podDesired = this.podDesired

      metric._cpuRequest = Number(((this.cpuUsageAvg/this.podDesired)).toFixed(2))
      metric._cpuLimit = 0


      const memory = (this.memoryUsageMax/this.podDesired)*1.2
      metric._memoryRequest = memory
      metric._memoryLimit = memory
      
      return metric
    }
}
