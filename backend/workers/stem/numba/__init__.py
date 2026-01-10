"""
Numba CUDA Kernels Package

JIT-compiled CUDA kernels for high-performance STEM computations in StudyLoG.AI.
"""

from .kernels import (
    NumbaAccelerator,
    KernelExecutionResult,
    get_numba_info,
)

__all__ = ['NumbaAccelerator', 'KernelExecutionResult', 'get_numba_info']
__version__ = '1.0.0'
