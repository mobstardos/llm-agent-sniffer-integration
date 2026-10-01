from src.agents.base import BaseAgent
from attic.prompts-legacy.onec_agent import ONEC_AGENT_SYSTEM, ONEC_AGENT_USER_TEMPLATE


class OneCAgent(BaseAgent):
    name = "onec"
    system_prompt = ONEC_AGENT_SYSTEM
    user_template = ONEC_AGENT_USER_TEMPLATE
    servers = ["onec"]
