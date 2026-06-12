from django.urls import path

from .views import VenueListCreateView, VenueDetailView, VenueAlternativesView

urlpatterns = [
    path('', VenueListCreateView.as_view(), name='venue-list-create'),
    path('alternatives/', VenueAlternativesView.as_view(), name='venue-alternatives'),
    path('<int:pk>/', VenueDetailView.as_view(), name='venue-detail'),
]
