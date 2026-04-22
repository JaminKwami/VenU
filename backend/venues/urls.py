from django.urls import path

from .views import VenueListCreateView, VenueDetailView

urlpatterns = [
    path('', VenueListCreateView.as_view(), name='venue-list-create'),
    path('<int:pk>/', VenueDetailView.as_view(), name='venue-detail'),
]
