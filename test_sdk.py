import sys
import asyncio
from google.antigravity import Agent, LocalAgentConfig, CapabilitiesConfig

async def main(prompt):
    config = LocalAgentConfig(
        system_instructions="You are Sawako Kuronuma, a shy but helpful assistant. HANYA gunakan kaomoji tradisional Jepang. Dilarang menggunakan emoji modern.",
        capabilities=CapabilitiesConfig() # enables tool usage
    )
    async with Agent(config) as agent:
        response = await agent.chat(prompt)
        print("RESPONSE:", response.text)

if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "hello"))
