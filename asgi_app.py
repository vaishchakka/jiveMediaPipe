# ASGI wrapper to run the Flask app with uvicorn
# Requires: asgiref (pip install asgiref)

from asgiref.wsgi import WsgiToAsgi
from api_server import app as flask_app

# Expose ASGI app for uvicorn
app = WsgiToAsgi(flask_app)
