"""
Sample Python module for testing parser
"""

from typing import List, Optional
import os


# Module-level constant
MAX_RETRIES = 3
API_URL = "https://api.example.com"


def simple_function(name: str) -> str:
    """Simple function with type hints"""
    return f"Hello, {name}"


async def async_function(url: str, timeout: int = 30) -> dict:
    """Async function with default parameter"""
    response = await fetch(url)
    return response


@staticmethod
@property
def decorated_function():
    """Function with decorators"""
    return "decorated"


class Calculator:
    """Calculator class with methods"""

    def __init__(self, initial: int = 0):
        """Constructor"""
        self.value = initial

    def add(self, x: int) -> int:
        """Public method"""
        self.value += x
        return self.value

    def _internal_helper(self) -> None:
        """Protected method"""
        pass

    def __private_method(self) -> None:
        """Private method"""
        pass

    @property
    def current_value(self) -> int:
        """Property decorator"""
        return self.value


class DataProcessor(BaseProcessor):
    """Class with inheritance"""

    async def process(self, data: List[str]) -> Optional[dict]:
        """Async method with complex types"""
        result = await self._process_internal(data)
        return result
