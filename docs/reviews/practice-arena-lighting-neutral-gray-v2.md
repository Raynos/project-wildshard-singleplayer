# Arena neutral-gray v2 candidate

Unaccepted bounded follow-on to the frozen v1 lighting study. Independent full desktop/phone-policy review and hemisphere/toon isolation found that neutral hemisphere fill supplied most of the improvement, while the warm v1 lift added unwanted yellow/olive to the cream.

This separate authored profile uses sky sRGB #e5e5e5, ground #a5a5a5, hemisphere intensity 1.15 and equal-channel linear toon lift [0.10, 0.10, 0.10]. The fixed world key, rim [0.65, 0.475, 0.3], optional contact AO, native vertex palette, geometry, gait and recoil policy remain unchanged. Fill strength does not increase from v1. No emissive/unlit material or camera-following light is introduced.

The profile lives in practiceNeutralGrayLighting.json under the explicit neutral-gray-v2 identifier. The original v1 file remains byte-identical at SHA256 0e39d9246fd4e547fc5ef087fb2bd3467538aef2d3a5966885ad4d112e729765. Builder admission still requires the exact V70 weighted native, source, dimensions, measurement, rig and unchanged gait tuple. The host receives strict numeric presentation data; no new engine behavior or global default is added. Omitted products retain their existing bytes.

Validation requires actual normal real Lock/strafe, followed by labelled old-profile/v1/v2 controls with identical paused actor, bone and camera matrices. Record real renderer policy rather than infer it from portrait dimensions; cloud phone-UA emulation must keep the 2x render buffer and cannot claim device performance. Independent review checks cream color, dark teal facets, bright-side washout and contact shadows.

The separate 0.05 versus 0.06 metre shadow-normal-bias study remains diagnostic only. V2 does not adopt a shadow-bias change. Existing fin stippling, V70 corpse contact and overall model/motion acceptance remain separate until demonstrated otherwise.
