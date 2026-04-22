from django.urls import path

from .views import BookingListCreateView, BookingDetailView, BookingApproveView, BookingRejectView

urlpatterns = [
    path('', BookingListCreateView.as_view(), name='booking-list-create'),
    path('<int:pk>/', BookingDetailView.as_view(), name='booking-detail'),
    path('<int:pk>/approve/', BookingApproveView.as_view(), name='booking-approve'),
    path('<int:pk>/reject/', BookingRejectView.as_view(), name='booking-reject'),
]
