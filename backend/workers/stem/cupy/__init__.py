"""
CuPy GPU Bridge Package

GPU acceleration bridge for StudyLoG.AI using CuPy (NumPy-compatible GPU arrays).
"""

from .bridge import GPUBridge, app

__all__ = ['GPUBridge', 'app']
__version__ = '1.0.0'
