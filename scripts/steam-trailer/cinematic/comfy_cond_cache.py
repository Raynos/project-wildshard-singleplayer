"""ComfyUI custom node pair: save / load a CONDITIONING with every option intact (TRAILERS CT1, E466).

ComfyUI-LTXVideo's LTXVSaveConditioning keeps only the tensor and the attention mask, and so drops LTX-2.5's
`unprocessed_ltxav_embeds` flag. ltx_comfy.py encodes the prompt first, saves it with this node, unloads the 25 GB
Gemma text encoder, then samples from the loaded file: ~25 GB less unified memory while the 22B transformer runs.
Symlink this file into ComfyUI/custom_nodes/.
"""
import torch


def _cpu(x):
    if isinstance(x, torch.Tensor):
        return x.detach().cpu()
    if isinstance(x, dict):
        return {k: _cpu(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return type(x)(_cpu(v) for v in x)
    return x


class SaveConditioningTorch:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"conditioning": ("CONDITIONING",), "path": ("STRING", {"default": ""})}}

    RETURN_TYPES = ()
    FUNCTION = "save"
    OUTPUT_NODE = True
    CATEGORY = "wildshard"

    def save(self, conditioning, path):
        torch.save(_cpu(conditioning), path)
        return {}


class LoadConditioningTorch:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"path": ("STRING", {"default": ""})}}

    RETURN_TYPES = ("CONDITIONING",)
    FUNCTION = "load"
    CATEGORY = "wildshard"

    def load(self, path):
        return (torch.load(path, weights_only=False),)


NODE_CLASS_MAPPINGS = {"SaveConditioningTorch": SaveConditioningTorch, "LoadConditioningTorch": LoadConditioningTorch}
