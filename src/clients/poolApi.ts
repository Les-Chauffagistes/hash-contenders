import {components} from "@chauffagistes/cmn"


export async function getPoolData(poolAddress: string) : Promise<components["schemas"]["PoolUser"]>{
    const response = await fetch(
        `${process.env.POOL_API_URL}/api/stats/${poolAddress}`
    )
    if (!response.ok) throw new Error(`Unable to fetch pool data: ${response.status}`);
    return response.json();
}

export async function getWorkerData(poolAddress: string, workername: string) : Promise<components["schemas"]["Worker"]>{
    const response = await fetch(
        `${process.env.POOL_API_URL}/api/stats/${poolAddress}/${workername}`
    )
    if (!response.ok) throw new Error(`Unable to fetch worker data: ${response.status}`);
    const data: components["schemas"]["PoolUser"] = await response.json()
    const worker =  data.worker.find(worker => worker.workername === workername)
    if (worker) return worker
    throw new Error(`Worker not found: ${workername}`)
}