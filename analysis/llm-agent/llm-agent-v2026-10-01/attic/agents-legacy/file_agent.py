from src.agents.base import BaseAgent
from attic.prompts-legacy.file_agent import FILE_AGENT_SYSTEM, FILE_AGENT_USER_TEMPLATE


class FileAgent(BaseAgent):
    name = "file"
    system_prompt = FILE_AGENT_SYSTEM
    user_template = FILE_AGENT_USER_TEMPLATE
    servers = ["filesystem"]
