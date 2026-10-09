interface Point { readonly x: number; readonly y: number; readonly z: number }
/** The lookout seat's page arithmetic. Pitch is camera presentation; position/yaw and zero velocity are gameplay. */
export function pineBenchPose(at: Point, yaw: number): { x: number; y: number; z: number; yaw: number; pitch: number } {
  return { x: at.x + Math.sin(yaw) * 0.2, y: at.y + 0.02, z: at.z + Math.cos(yaw) * 0.2,
    yaw: yaw + Math.PI, pitch: 0.05 };
}
