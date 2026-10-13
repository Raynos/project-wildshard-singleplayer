/** Original beaver-pool mesh channels, retained as float32-exact JSON rows. */
export interface PoolMesh { position: number[]; uv: number[]; aWater: number[]; index: number[] }
/** Still-water renderer ground samples and the original flow ribbon. */
export interface PoolRows { still: PoolMesh & { ground: number[] }; trickle: PoolMesh }
